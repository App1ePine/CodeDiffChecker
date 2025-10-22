const metricsRegistry = []

const DEFAULT_HISTOGRAM_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.3, 0.5, 1, 1.5, 3, 5, 10]

const escapeLabelValue = (value) => {
  if (value === undefined || value === null) return ''
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

const formatLabels = (labels) => {
  const entries = Object.entries(labels)
    .filter(([_, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}="${escapeLabelValue(value)}"`)
  if (entries.length === 0) {
    return ''
  }
  return `{${entries.join(',')}}`
}

class Counter {
  constructor({ name, help, labelNames = [] }) {
    this.name = name
    this.help = help
    this.labelNames = labelNames
    this.series = new Map()
    metricsRegistry.push(this)
  }

  inc(labels = {}, value = 1) {
    const amount = Number(value) || 1
    const normalizedLabels = this.#normalizeLabels(labels)
    const key = this.#keyFromLabels(normalizedLabels)
    const current = this.series.get(key) ?? { labels: normalizedLabels, value: 0 }
    current.value += amount
    this.series.set(key, current)
  }

  #normalizeLabels(labels) {
    const normalized = {}
    for (const name of this.labelNames) {
      if (labels[name] !== undefined) {
        normalized[name] = labels[name]
      }
    }
    return normalized
  }

  #keyFromLabels(labels) {
    return this.labelNames.map((name) => `${name}:${labels[name] ?? ''}`).join('|')
  }

  render() {
    if (this.series.size === 0) return ''

    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`]
    for (const { labels, value } of this.series.values()) {
      lines.push(`${this.name}${formatLabels(labels)} ${value}`)
    }
    return lines.join('\n')
  }
}

class Histogram {
  constructor({ name, help, labelNames = [], buckets = DEFAULT_HISTOGRAM_BUCKETS }) {
    this.name = name
    this.help = help
    this.labelNames = labelNames
    this.buckets = buckets.slice().sort((a, b) => a - b)
    this.series = new Map()
    metricsRegistry.push(this)
  }

  observe(labels = {}, value) {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) {
      return
    }
    const normalizedLabels = this.#normalizeLabels(labels)
    const key = this.#keyFromLabels(normalizedLabels)
    const current = this.series.get(key) ?? {
      labels: normalizedLabels,
      buckets: Array.from({ length: this.buckets.length }, () => 0),
      sum: 0,
      count: 0,
    }

    for (let index = 0; index < this.buckets.length; index += 1) {
      if (numericValue <= this.buckets[index]) {
        current.buckets[index] += 1
      }
    }

    current.sum += numericValue
    current.count += 1

    this.series.set(key, current)
  }

  startTimer(labels = {}) {
    const start = process.hrtime.bigint()
    return (extraLabels = {}) => {
      const end = process.hrtime.bigint()
      const diffInSeconds = Number(end - start) / 1e9
      this.observe({ ...labels, ...extraLabels }, diffInSeconds)
      return diffInSeconds
    }
  }

  #normalizeLabels(labels) {
    const normalized = {}
    for (const name of this.labelNames) {
      if (labels[name] !== undefined) {
        normalized[name] = labels[name]
      }
    }
    return normalized
  }

  #keyFromLabels(labels) {
    return this.labelNames.map((name) => `${name}:${labels[name] ?? ''}`).join('|')
  }

  render() {
    if (this.series.size === 0) return ''

    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`]

    for (const { labels, buckets, count, sum } of this.series.values()) {
      let cumulative = 0
      for (let index = 0; index < this.buckets.length; index += 1) {
        cumulative += buckets[index]
        const bucketLabel = { ...labels, le: this.buckets[index] }
        lines.push(`${this.name}_bucket${formatLabels(bucketLabel)} ${cumulative}`)
      }

      lines.push(`${this.name}_bucket${formatLabels({ ...labels, le: '+Inf' })} ${count}`)
      lines.push(`${this.name}_sum${formatLabels(labels)} ${sum}`)
      lines.push(`${this.name}_count${formatLabels(labels)} ${count}`)
    }

    return lines.join('\n')
  }
}

const renderMetrics = () => {
  const output = metricsRegistry
    .map((metric) => metric.render())
    .filter((content) => content.length > 0)
    .join('\n\n')

  return output.length > 0 ? `${output}\n` : ''
}

export { Counter, Histogram, renderMetrics }
