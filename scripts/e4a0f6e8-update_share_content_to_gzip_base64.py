"""
批量将 shares 表的 left_content/right_content 转为 gzip+base64 格式。

依赖：
- pandas
- SQLAlchemy
- 对应数据库驱动：
  - MySQL: pymysql
  - PostgreSQL: psycopg2-binary
  - SQL Server: pymssql

使用示例：
    1. 项目所在端执行
        python scripts/e4a0f6e8-update_share_content_to_gzip_base64.py \\
            --db-type mysql \\
            --host 127.0.0.1 --port 3306 \\
            --user root --password secret --database code_diff_checker \\
            --batch-size 500
    2. 远程执行(本地执行 Python, 通过 SSH 隧道把远程数据库暴露到本地端口)
        2.1 建立隧道
            `ssh -N -L 3307:127.0.0.1:3306 your_user@your_server -i /path/to/ssh_key`
        2.2 本地执行脚本, 数据库执行本地端口 3307
            `python scripts/e4a0f6e8-update_share_content_to_gzip_base64.py ...`


注意：运行前请做好数据库备份，并确保业务侧已停写，避免新旧格式混用。
"""

import argparse
import base64
import gzip
from collections.abc import Iterable
from urllib.parse import quote_plus

import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="迁移 shares 表内容为 gzip+base64")
    parser.add_argument("--db-type", choices=["mysql", "postgresql", "mssql"], required=True, help="数据库类型")
    parser.add_argument("--host", required=True, help="数据库主机")
    parser.add_argument("--port", type=int, required=True, help="数据库端口")
    parser.add_argument("--user", required=True, help="数据库用户")
    parser.add_argument("--password", required=True, help="数据库密码")
    parser.add_argument("--database", required=True, help="数据库名称")
    parser.add_argument("--batch-size", type=int, default=500, help="每批处理行数，默认 500")
    return parser.parse_args()


def build_db_url(args: argparse.Namespace) -> str:
    user = quote_plus(args.user)
    password = quote_plus(args.password)
    host = args.host
    port = args.port
    database = quote_plus(args.database)

    if args.db_type == "mysql":
        return f"mysql+pymysql://{user}:{password}@{host}:{port}/{database}"
    if args.db_type == "postgresql":
        return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{database}"
    return f"mssql+pymssql://{user}:{password}@{host}:{port}/{database}?charset=utf8"


def to_gzip_base64(text: str) -> str:
    compressed = gzip.compress(text.encode("utf-8"))
    return base64.b64encode(compressed).decode("ascii")


def is_gzip_base64(text: str) -> bool:
    try:
        raw = base64.b64decode(text, validate=True)
        if len(raw) < 2 or raw[0] != 0x1F or raw[1] != 0x8B:
            return False
        gzip.decompress(raw).decode("utf-8")
        return True
    except Exception:
        return False


def encode_if_needed(text: str) -> str:
    if is_gzip_base64(text):
        return text
    return to_gzip_base64(text)


def fetch_batch(engine: Engine, db_type: str, offset: int, batch_size: int) -> pd.DataFrame:
    if db_type == "mssql":
        query = text("SELECT id, left_content, right_content FROM shares ORDER BY id OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY")
    else:
        query = text("SELECT id, left_content, right_content FROM shares ORDER BY id LIMIT :limit OFFSET :offset")

    return pd.read_sql_query(query, engine, params={"limit": batch_size, "offset": offset})


BatchRow = tuple[str, str, int]


def update_batch(engine: Engine, rows: Iterable[BatchRow]) -> None:
    update_sql = text("UPDATE shares SET left_content = :left_content, right_content = :right_content WHERE id = :id")
    with engine.begin() as conn:
        conn.execute(
            update_sql,
            [{"left_content": left, "right_content": right, "id": row_id} for left, right, row_id in rows],
        )


def process(engine: Engine, db_type: str, batch_size: int) -> None:
    offset = 0
    total_checked = 0
    total_processed = 0

    while True:
        df = fetch_batch(engine, db_type, offset, batch_size)
        if df.empty:
            break

        total_checked += len(df)

        left_is_encoded = df["left_content"].map(is_gzip_base64)
        right_is_encoded = df["right_content"].map(is_gzip_base64)
        batch_processed = int((~(left_is_encoded & right_is_encoded)).sum())

        encoded_df = df.assign(
            left_content=lambda d: d["left_content"].map(encode_if_needed),
            right_content=lambda d: d["right_content"].map(encode_if_needed),
        )

        rows: list[BatchRow] = list(zip(encoded_df["left_content"], encoded_df["right_content"], encoded_df["id"]))

        update_batch(engine, rows)

        total_processed += batch_processed
        offset += batch_size
        print(f"已检查 {total_checked} 行，已转换 {total_processed} 行...")

    print(f"完成，累计检查 {total_checked} 行，累计转换 {total_processed} 行。")


def main() -> None:
    args = parse_args()
    engine = create_engine(build_db_url(args))
    process(engine, args.db_type, args.batch_size)


if __name__ == "__main__":
    main()
