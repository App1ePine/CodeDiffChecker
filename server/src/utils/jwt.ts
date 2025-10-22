import jwt from 'jsonwebtoken';
import { appConfig } from '../config/env';

export type JwtPayload = {
  sub: number;
};

export function signToken(userId: number): string {
  return jwt.sign({ sub: userId }, appConfig.jwt.secret, {
    expiresIn: appConfig.jwt.expiresIn
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, appConfig.jwt.secret) as JwtPayload;
}
