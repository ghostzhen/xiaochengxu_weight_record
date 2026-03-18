const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`)
const formatDateYMD = (dt) => `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`
const formatMMDD = (ymd) => (typeof ymd === 'string' ? ymd.slice(5) : '')
const addDays = (dt, n) => {
  const t = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
  t.setDate(t.getDate() + n)
  return t
}
const parseTimeToMinutes = (hhmm) => {
  if (!hhmm || typeof hhmm !== 'string' || hhmm.indexOf(':') < 0) return null
  const p = hhmm.split(':')
  const h = parseInt(p[0], 10)
  const m = parseInt(p[1], 10)
  if (!(h >= 0 && h <= 23 && m >= 0 && m <= 59)) return null
  return h * 60 + m
}
const calcDurationByTimes = (sleepTime, wakeTime) => {
  const s = parseTimeToMinutes(sleepTime)
  const w = parseTimeToMinutes(wakeTime)
  if (s === null || w === null) return null
  let delta = w - s
  if (delta <= 0) delta += 24 * 60
  const halfHours = Math.max(0.5, Math.round((delta / 60) * 2) / 2)
  return halfHours
}
const autoSleepQuality = (duration, sleepTime, isStayUp) => {
  if (!(duration > 0)) return 0
  let score = 3
  if (duration >= 7 && duration <= 9) score += 1
  if (duration < 6 || duration > 10) score -= 1
  const s = parseTimeToMinutes(sleepTime)
  if (s !== null && s <= 23 * 60) score += 1
  if (isStayUp) score -= 1
  if (score < 1) score = 1
  if (score > 5) score = 5
  return score
}
const sleepQualityText = (score) => {
  if (score >= 5) return '优秀'
  if (score >= 4) return '良好'
  if (score >= 3) return '一般'
  if (score >= 2) return '偏差'
  if (score >= 1) return '较差'
  return '--'
}
const clampNumber = (v, min, max) => Math.max(min, Math.min(max, v))
const roundTo50 = (v) => Math.round(v / 50) * 50

const createEmptyChartData = () => ({
  xLabels: [],
  series: [{ name: '体重', color: '#2979ff', values: [] }],
})

const getNumericValues = (values) =>
  (Array.isArray(values) ? values : []).map((v) => (typeof v === 'number' ? v : Number(v))).filter((v) => Number.isFinite(v))

const getWeekStart = (dt) => {
  const d = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
  const day = d.getDay()
  const offset = (day + 6) % 7
  return addDays(d, -offset)
}

const pickRangeFirstLast = (map, startDt, endDt) => {
  let first = null
  let last = null
  for (let i = 0; ; i++) {
    const dt = addDays(startDt, i)
    if (dt.getTime() > endDt.getTime()) break
    const key = formatDateYMD(dt)
    const v = map.get(key)
    if (Number.isFinite(v)) {
      if (!first) first = { date: key, weight: v }
      last = { date: key, weight: v }
    }
  }
  return { first, last }
}

const formatDeltaText = (deltaKg, baseKg) => {
  if (!Number.isFinite(deltaKg) || !Number.isFinite(baseKg) || baseKg === 0) return '--'
  const sign = deltaKg > 0 ? '+' : deltaKg < 0 ? '-' : ''
  const abs = Math.abs(deltaKg)
  const pct = (deltaKg / baseKg) * 100
  const pctSign = pct > 0 ? '+' : pct < 0 ? '-' : ''
  return `${sign}${abs.toFixed(1)}kg ${pctSign}${Math.abs(pct).toFixed(1)}%`
}

const deltaClass = (deltaKg) => {
  if (!Number.isFinite(deltaKg) || deltaKg === 0) return 'delta-flat'
  return deltaKg > 0 ? 'delta-up' : 'delta-down'
}

Page({
  data: {
    chart: createEmptyChartData(),
    activeIndex: -1,
    todayDate: '',
    weekThisText: '--',
    weekLastText: '--',
    monthThisText: '--',
    monthLastText: '--',
    weekThisClass: 'delta-flat',
    weekLastClass: 'delta-flat',
    monthThisClass: 'delta-flat',
    monthLastClass: 'delta-flat',
    showDietInput: false,
    dietTagOptions: ['清淡', '正常', '重油', '外卖', '暴饮暴食'],
    dietTagIndex: -1,
    dietTag: '',
    dietDrinkWater: '',
    dietHasSnack: false,
    dietHasSugary: false,
    dietRemark: '',
    latestDietDate: '--',
    latestDietText: '暂无记录',
    showSleepInput: false,
    sleepTime: '',
    wakeTime: '',
    sleepDuration: '',
    sleepQuality: 0,
    sleepQualityText: '--',
    isStayUp: false,
    latestSleepDate: '--',
    latestSleepText: '暂无记录',
    showWaterInput: false,
    waterGoalMl: 2000,
    waterActivityOptions: ['久坐', '日常活动', '高活动量'],
    waterActivityIndex: 1,
    waterActivityFactorList: [1, 1.15, 1.3],
    waterHeightCm: '',
    waterWeightKg: '',
    recommendedWaterGoal: 2000,
    waterManualInput: '',
    todayWaterMl: 0,
    waterTodayPercent: 0,
    waterWeekAvg: 0,
    waterMonthAvg: 0,
    waterStreakDays: 0,
    waterBadgeText: '继续加油',
    waterWeekSeries: [],
    waterMonthSeries: [],
    waterWeekHeights: [],
    waterMonthHeights: [],
    showSleepSettingInput: false,
    sleepPlanBedtime: '23:00',
    sleepPlanWakeTime: '07:00',
  },

  onShow() {
    this.setData({ todayDate: formatDateYMD(new Date()) })
    this._loadLast7Days()
    this.loadTodayHabitRecords()
    this.loadLatestHabitSummary()
    this.loadWaterReminderData()
    this.loadSleepSettings()
    this.applyPendingAction()
  },

  onReady() {
    this._initChartCanvas()
  },

  onUnload() {
    this._chart = null
  },
  buildErrorMessage(err) {
    return '操作失败，请稍后重试'
  },
  showSaveError(title, err) {
    wx.showModal({
      title,
      content: this.buildErrorMessage(err),
      showCancel: false,
    })
  },

  async _loadLast7Days() {
    const cached = wx.getStorageSync('userRegistered')
    if (!cached) {
      wx.setStorageSync('afterLoginTab', '/pages/chart/index')
      wx.switchTab({ url: '/pages/profile/index' })
      return
    }

    const openid = wx.getStorageSync('openid') || ''
    if (!openid) {
      wx.setStorageSync('afterLoginTab', '/pages/chart/index')
      wx.switchTab({ url: '/pages/profile/index' })
      return
    }

    const end = new Date()
    const endStr = formatDateYMD(end)

    const db = wx.cloud.database()
    const _ = db.command

    try {
      const compareStart = addDays(end, -70)
      const compareStartStr = formatDateYMD(compareStart)
      const res = await db
        .collection('weight_records')
        .where({ _openid: openid, date: _.gte(compareStartStr).and(_.lte(endStr)) })
        .orderBy('date', 'asc')
        .get()

      const rows = Array.isArray(res?.data) ? res.data : []
      const map = new Map()
      for (const r of rows) {
        const date = r?.date
        const weight = r?.weight
        if (typeof date === 'string' && date) map.set(date, typeof weight === 'number' ? weight : Number(weight))
      }

      const xLabels = []
      const values = []
      for (let i = 0; i < 7; i++) {
        const dt = addDays(end, -(6 - i))
        const ymd = formatDateYMD(dt)
        xLabels.push(formatMMDD(ymd))
        const v = map.get(ymd)
        values.push(Number.isFinite(v) ? v : null)
      }

      const today = new Date(end.getFullYear(), end.getMonth(), end.getDate())
      const thisWeekStart = getWeekStart(today)
      const lastWeekStart = addDays(thisWeekStart, -7)
      const lastWeekEnd = addDays(thisWeekStart, -1)
      const thisWeek = pickRangeFirstLast(map, thisWeekStart, today)
      const lastWeek = pickRangeFirstLast(map, lastWeekStart, lastWeekEnd)
      const thisWeekDelta = thisWeek.first && thisWeek.last ? thisWeek.last.weight - thisWeek.first.weight : NaN
      const lastWeekDelta = lastWeek.first && lastWeek.last ? lastWeek.last.weight - lastWeek.first.weight : NaN

      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
      const prevMonthStart = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1)
      const sameDay = Math.min(today.getDate(), prevMonthEnd.getDate())
      const prevMonthEndToDate = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), sameDay)
      const thisMonth = pickRangeFirstLast(map, monthStart, today)
      const lastMonth = pickRangeFirstLast(map, prevMonthStart, prevMonthEndToDate)
      const thisMonthDelta = thisMonth.first && thisMonth.last ? thisMonth.last.weight - thisMonth.first.weight : NaN
      const lastMonthDelta = lastMonth.first && lastMonth.last ? lastMonth.last.weight - lastMonth.first.weight : NaN

      const chart = {
        xLabels,
        series: [{ name: '体重', color: '#2979ff', values }],
      }
      this.setData(
        {
          chart,
          activeIndex: -1,
          weekThisText: thisWeek.first ? formatDeltaText(thisWeekDelta, thisWeek.first.weight) : '--',
          weekLastText: lastWeek.first ? formatDeltaText(lastWeekDelta, lastWeek.first.weight) : '--',
          monthThisText: thisMonth.first ? formatDeltaText(thisMonthDelta, thisMonth.first.weight) : '--',
          monthLastText: lastMonth.first ? formatDeltaText(lastMonthDelta, lastMonth.first.weight) : '--',
          weekThisClass: deltaClass(thisWeekDelta),
          weekLastClass: deltaClass(lastWeekDelta),
          monthThisClass: deltaClass(thisMonthDelta),
          monthLastClass: deltaClass(lastMonthDelta),
        },
        () => this._renderChart()
      )
    } catch (e) {
      const xLabels = []
      const values = []
      for (let i = 0; i < 7; i++) {
        const dt = addDays(end, -(6 - i))
        const ymd = formatDateYMD(dt)
        xLabels.push(formatMMDD(ymd))
        values.push(null)
      }
      const chart = { xLabels, series: [{ name: '体重', color: '#2979ff', values }] }
      this.setData(
        {
          chart,
          activeIndex: -1,
          weekThisText: '--',
          weekLastText: '--',
          monthThisText: '--',
          monthLastText: '--',
          weekThisClass: 'delta-flat',
          weekLastClass: 'delta-flat',
          monthThisClass: 'delta-flat',
          monthLastClass: 'delta-flat',
        },
        () => this._renderChart()
      )
    }
  },
  async loadTodayHabitRecords() {
    const openid = wx.getStorageSync('openid') || ''
    if (!openid) return
    const dateStr = formatDateYMD(new Date())
    const db = wx.cloud.database()
    const docId = openid + '_' + dateStr
    try {
      const dietRes = await db.collection('diet_record').doc(docId).get()
      const d = (dietRes && dietRes.data) ? dietRes.data : null
      if (d) {
        const opts = this.data.dietTagOptions || []
        const idx = opts.indexOf(d.diet_tag || '')
        this.setData({
          dietTag: d.diet_tag || '',
          dietTagIndex: idx,
          dietDrinkWater: (typeof d.drink_water === 'number' && !isNaN(d.drink_water)) ? ('' + d.drink_water) : '',
          dietHasSnack: !!d.has_snack,
          dietHasSugary: !!d.has_sugary,
          dietRemark: d.remark || ''
        })
      } else {
        this.setData({
          dietTag: '',
          dietTagIndex: -1,
          dietDrinkWater: '',
          dietHasSnack: false,
          dietHasSugary: false,
          dietRemark: ''
        })
      }
    } catch (e) {
      this.setData({
        dietTag: '',
        dietTagIndex: -1,
        dietDrinkWater: '',
        dietHasSnack: false,
        dietHasSugary: false,
        dietRemark: ''
      })
    }
    try {
      const sleepRes = await db.collection('sleep_record').doc(docId).get()
      const s = (sleepRes && sleepRes.data) ? sleepRes.data : null
      if (s) {
        const sq = (typeof s.sleep_quality === 'number' && s.sleep_quality >= 1 && s.sleep_quality <= 5) ? ('' + s.sleep_quality) : ''
        this.setData({
          sleepTime: s.sleep_time || '',
          wakeTime: s.wake_time || '',
          sleepDuration: (typeof s.sleep_duration === 'number' && !isNaN(s.sleep_duration)) ? ('' + s.sleep_duration) : '',
          sleepQuality: sq ? parseInt(sq, 10) : autoSleepQuality(
            (typeof s.sleep_duration === 'number' && !isNaN(s.sleep_duration)) ? s.sleep_duration : calcDurationByTimes(s.sleep_time || '', s.wake_time || ''),
            s.sleep_time || '',
            !!s.is_stay_up
          ),
          sleepQualityText: sq ? sleepQualityText(parseInt(sq, 10)) : sleepQualityText(autoSleepQuality(
            (typeof s.sleep_duration === 'number' && !isNaN(s.sleep_duration)) ? s.sleep_duration : calcDurationByTimes(s.sleep_time || '', s.wake_time || ''),
            s.sleep_time || '',
            !!s.is_stay_up
          )),
          isStayUp: !!s.is_stay_up
        })
      } else {
        this.setData({
          sleepTime: '',
          wakeTime: '',
          sleepDuration: '',
          sleepQuality: 0,
          sleepQualityText: '--',
          isStayUp: false
        })
      }
    } catch (e) {
      this.setData({
        sleepTime: '',
        wakeTime: '',
        sleepDuration: '',
        sleepQuality: 0,
        sleepQualityText: '--',
        isStayUp: false
      })
    }
  },
  async loadLatestHabitSummary() {
    const openid = wx.getStorageSync('openid') || ''
    if (!openid) {
      this.setData({
        latestDietDate: '--',
        latestDietText: '暂无记录',
        latestSleepDate: '--',
        latestSleepText: '暂无记录'
      })
      return
    }
    const db = wx.cloud.database()
    try {
      const dietRes = await db.collection('diet_record').where({ _openid: openid }).orderBy('record_date', 'desc').limit(1).get()
      const d = (dietRes && dietRes.data && dietRes.data[0]) ? dietRes.data[0] : null
      if (d) {
        const tags = []
        if (d.diet_tag) tags.push(d.diet_tag)
        if (typeof d.drink_water === 'number' && !isNaN(d.drink_water) && d.drink_water > 0) tags.push(d.drink_water + 'ml')
        if (d.has_snack) tags.push('夜宵')
        if (d.has_sugary) tags.push('含糖饮料/酒')
        this.setData({
          latestDietDate: d.record_date || '--',
          latestDietText: tags.length ? tags.join(' · ') : '已记录'
        })
      } else {
        this.setData({ latestDietDate: '--', latestDietText: '暂无记录' })
      }
    } catch (e) {
      this.setData({ latestDietDate: '--', latestDietText: '暂无记录' })
    }

    try {
      const sleepRes = await db.collection('sleep_record').where({ _openid: openid }).orderBy('record_date', 'desc').limit(1).get()
      const s = (sleepRes && sleepRes.data && sleepRes.data[0]) ? sleepRes.data[0] : null
      if (s) {
        const d = (typeof s.sleep_duration === 'number' && !isNaN(s.sleep_duration)) ? s.sleep_duration : calcDurationByTimes(s.sleep_time || '', s.wake_time || '')
        const q = (typeof s.sleep_quality === 'number' && s.sleep_quality >= 1 && s.sleep_quality <= 5)
          ? s.sleep_quality
          : autoSleepQuality(d || 0, s.sleep_time || '', !!s.is_stay_up)
        const text = (d ? (d + 'h') : '--') + ' · ' + sleepQualityText(q)
        this.setData({
          latestSleepDate: s.record_date || '--',
          latestSleepText: text
        })
      } else {
        this.setData({ latestSleepDate: '--', latestSleepText: '暂无记录' })
      }
    } catch (e) {
      this.setData({ latestSleepDate: '--', latestSleepText: '暂无记录' })
    }
  },

  async _initChartCanvas() {
    const query = wx.createSelectorQuery().in(this)
    query
      .select('#lineChart')
      .fields({ node: true, size: true })
      .select('#chartWrap')
      .boundingClientRect()
      .exec((res) => {
        const canvasNode = res?.[0]?.node
        const canvasSize = res?.[0]
        const wrapRect = res?.[1]

        if (!canvasNode || !canvasSize || !wrapRect) return

        const dpr = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : wx.getSystemInfoSync().pixelRatio
        const width = Math.max(1, Math.floor(wrapRect.width))
        const height = Math.max(1, Math.floor(wrapRect.height))

        canvasNode.width = Math.floor(width * dpr)
        canvasNode.height = Math.floor(height * dpr)

        const ctx = canvasNode.getContext('2d')
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        this._chart = {
          canvas: canvasNode,
          ctx,
          width,
          height,
          dpr,
        }

        this._renderChart()
      })
  },

  _renderChart() {
    const chart = this.data.chart
    const activeIndex = this.data.activeIndex
    const engine = this._chart
    if (!engine || !chart?.xLabels?.length || !chart?.series?.length) return

    const { ctx, width, height } = engine
    const padding = { left: 44, right: 18, top: 20, bottom: 34 }
    const plot = {
      left: padding.left,
      right: width - padding.right,
      top: padding.top,
      bottom: height - padding.bottom,
    }
    const plotWidth = Math.max(1, plot.right - plot.left)
    const plotHeight = Math.max(1, plot.bottom - plot.top)

    const xCount = chart.xLabels.length
    const xStep = xCount <= 1 ? 0 : plotWidth / (xCount - 1)

    const allValues = (Array.isArray(chart.series) ? chart.series : []).reduce((acc, s) => {
      const next = getNumericValues(s && s.values)
      for (let i = 0; i < next.length; i++) acc.push(next[i])
      return acc
    }, [])
    if (!allValues.length) {
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, width, height)
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('暂无体重记录', width / 2, height / 2)
      return
    }

    const rawMin = Math.min(...allValues)
    const rawMax = Math.max(...allValues)
    const range = rawMax - rawMin || 1
    const pad = range * 0.12
    const yMin = rawMin - pad
    const yMax = rawMax + pad

    const valueToY = (v) => plot.bottom - ((v - yMin) / (yMax - yMin)) * plotHeight
    const indexToX = (i) => plot.left + xStep * i

    ctx.clearRect(0, 0, width, height)

    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)

    this._drawGrid(ctx, plot, yMin, yMax)
    this._drawXAxisLabels(ctx, plot, chart.xLabels, indexToX)

    for (const s of chart.series) {
      this._drawSeries(ctx, plot, s, indexToX, valueToY)
    }

    if (activeIndex >= 0 && activeIndex < xCount) {
      this._drawActiveMarker(ctx, plot, chart, activeIndex, indexToX, valueToY)
    }
  },

  _drawGrid(ctx, plot, yMin, yMax) {
    const lines = 6
    ctx.save()

    ctx.strokeStyle = 'rgba(0,0,0,0.08)'
    ctx.lineWidth = 1
    for (let i = 0; i <= lines; i++) {
      const t = i / lines
      const y = plot.top + (plot.bottom - plot.top) * t
      ctx.beginPath()
      ctx.moveTo(plot.left, y)
      ctx.lineTo(plot.right, y)
      ctx.stroke()
    }

    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let i = 0; i <= lines; i++) {
      const t = 1 - i / lines
      const v = yMin + (yMax - yMin) * t
      const y = plot.top + (plot.bottom - plot.top) * (i / lines)
      ctx.fillText(String((Math.round(v * 10) / 10).toFixed(1)), plot.left - 8, y)
    }

    ctx.restore()
  },

  _drawXAxisLabels(ctx, plot, labels, indexToX) {
    const count = labels.length
    const step = count <= 7 ? 1 : count <= 1 ? 1 : Math.ceil(count / 5)

    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (let i = 0; i < count; i += step) {
      ctx.fillText(labels[i], indexToX(i), plot.bottom + 10)
    }
    if (count > 1 && (count - 1) % step !== 0) {
      ctx.fillText(labels[count - 1], indexToX(count - 1), plot.bottom + 10)
    }
    ctx.restore()
  },

  _drawSeries(ctx, plot, series, indexToX, valueToY) {
    const values = Array.isArray(series.values) ? series.values : []
    if (!values.length) return

    const color = series.color || '#2979ff'

    ctx.save()
    ctx.lineWidth = 2
    ctx.strokeStyle = color
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    ctx.beginPath()
    let started = false
    for (let i = 0; i < values.length; i++) {
      const x = indexToX(i)
      const v = values[i]
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        started = false
        continue
      }
      const y = valueToY(v)
      if (!started) {
        ctx.moveTo(x, y)
        started = true
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.stroke()

    ctx.fillStyle = color
    for (let i = 0; i < values.length; i++) {
      const x = indexToX(i)
      const v = values[i]
      if (typeof v !== 'number' || !Number.isFinite(v)) continue
      const y = valueToY(v)
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  },

  _drawActiveMarker(ctx, plot, chart, activeIndex, indexToX, valueToY) {
    const x = indexToX(activeIndex)

    ctx.save()
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, plot.top)
    ctx.lineTo(x, plot.bottom)
    ctx.stroke()

    const s = chart.series[0]
    const v = s?.values?.[activeIndex]
    const vv = typeof v === 'number' ? v : Number(v)
    if (Number.isFinite(vv)) {
      const y = valueToY(vv)

      ctx.fillStyle = '#fff'
      ctx.strokeStyle = s.color || '#2979ff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      const label = `${chart.xLabels[activeIndex]}  ${vv}`
      this._drawTooltip(ctx, plot, x, y, label)
    }

    ctx.restore()
  },

  _drawTooltip(ctx, plot, x, y, text) {
    const paddingX = 10
    const paddingY = 6
    ctx.save()
    ctx.font = '12px sans-serif'
    const metrics = ctx.measureText(text)
    const w = Math.ceil(metrics.width) + paddingX * 2
    const h = 26

    const boxX = clamp(x - w / 2, plot.left, plot.right - w)
    const preferTop = y - h - 10
    const boxY = preferTop >= plot.top ? preferTop : clamp(y + 10, plot.top, plot.bottom - h)

    ctx.fillStyle = 'rgba(0,0,0,0.75)'
    ctx.beginPath()
    this._roundRectPath(ctx, boxX, boxY, w, h, 8)
    ctx.fill()

    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, boxX + w / 2, boxY + h / 2)
    ctx.restore()
  },

  _roundRectPath(ctx, x, y, w, h, r) {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2))
    ctx.moveTo(x + radius, y)
    ctx.arcTo(x + w, y, x + w, y + h, radius)
    ctx.arcTo(x + w, y + h, x, y + h, radius)
    ctx.arcTo(x, y + h, x, y, radius)
    ctx.arcTo(x, y, x + w, y, radius)
    ctx.closePath()
  },

  _pickIndexFromTouch(touchX) {
    const engine = this._chart
    const chart = this.data.chart
    if (!engine || !chart?.xLabels?.length) return -1

    const padding = { left: 44, right: 18 }
    const plotLeft = padding.left
    const plotRight = engine.width - padding.right
    const plotWidth = Math.max(1, plotRight - plotLeft)
    const xCount = chart.xLabels.length
    if (xCount <= 1) return 0

    const t = clamp((touchX - plotLeft) / plotWidth, 0, 1)
    return clamp(Math.round(t * (xCount - 1)), 0, xCount - 1)
  },

  onHabit(e) {
    const type = e?.currentTarget?.dataset?.type
    if (type === 'diet') {
      this.setData({ showDietInput: true })
      return
    }
    if (type === 'water') {
      this.setData({ showWaterInput: true })
      return
    }
    if (type === 'routine') {
      this.setData({ showSleepInput: true })
      return
    }
    if (type === 'sleepSetting') {
      this.setData({ showSleepSettingInput: true })
      return
    }
    wx.showToast({ title: '习惯', icon: 'none' })
  },
  applyPendingAction() {
    const action = wx.getStorageSync('chartAction') || ''
    if (!action) return
    wx.removeStorageSync('chartAction')
    if (action === 'water') {
      this.setData({ showWaterInput: true })
      return
    }
    if (action === 'sleep') {
      this.setData({ showSleepSettingInput: true })
    }
  },
  async loadWaterReminderData() {
    const openid = wx.getStorageSync('openid') || ''
    if (!openid) return
    const db = wx.cloud.database()
    const _ = db.command
    const today = new Date()
    const todayStr = formatDateYMD(today)
    const monthStart = addDays(today, -29)
    const monthStartStr = formatDateYMD(monthStart)
    let setting = null
    let user = null
    let latestWeight = NaN
    let rows = []
    try {
      const [sRes, uRes, wRes, dRes] = await Promise.all([
        db.collection('water_setting').doc(openid).get().catch(() => null),
        db.collection('user').doc(openid).get().catch(() => null),
        db.collection('weight_records').where({ _openid: openid }).orderBy('date', 'desc').limit(1).get().catch(() => null),
        db.collection('diet_record').where({ _openid: openid, record_date: _.gte(monthStartStr).and(_.lte(todayStr)) }).orderBy('record_date', 'asc').get().catch(() => null),
      ])
      user = uRes && uRes.data ? uRes.data : null
      setting = (sRes && sRes.data) ? sRes.data : ((user && user.waterSetting) ? user.waterSetting : null)
      const wr = wRes && Array.isArray(wRes.data) ? wRes.data : []
      if (wr[0] && Number.isFinite(Number(wr[0].weight))) latestWeight = Number(wr[0].weight)
      rows = dRes && Array.isArray(dRes.data) ? dRes.data : []
    } catch (e) {}
    const heightCm = setting && setting.heightCm ? Number(setting.heightCm) : (user && user.heightCm ? Number(user.heightCm) : NaN)
    const weightKg = setting && setting.weightKg ? Number(setting.weightKg) : (Number.isFinite(latestWeight) ? latestWeight : NaN)
    const activityIndex = setting && Number.isFinite(Number(setting.activityIndex)) ? clampNumber(Number(setting.activityIndex), 0, 2) : 1
    const factor = this.data.waterActivityFactorList[activityIndex] || 1.15
    const base = Number.isFinite(weightKg) && weightKg > 0 ? weightKg * 30 : 2000
    const recommendedGoal = clampNumber(roundTo50(base * factor), 1200, 4500)
    const goal = setting && Number(setting.goalMl) > 0 ? clampNumber(Number(setting.goalMl), 500, 6000) : recommendedGoal
    const byDate = new Map()
    rows.forEach((r) => {
      if (r && typeof r.record_date === 'string') byDate.set(r.record_date, Number(r.drink_water) || 0)
    })
    const todayWater = byDate.get(todayStr) || 0
    const weekSeries = []
    const weekHeights = []
    const monthHeights = []
    let weekSum = 0
    for (let i = 0; i < 7; i++) {
      const dt = addDays(today, -(6 - i))
      const key = formatDateYMD(dt)
      const v = byDate.get(key) || 0
      weekSeries.push(v)
      weekHeights.push(Math.max(8, Math.round(v / 40)))
      weekSum += v
    }
    const monthSeries = []
    let monthSum = 0
    for (let i = 0; i < 30; i++) {
      const dt = addDays(today, -(29 - i))
      const key = formatDateYMD(dt)
      const v = byDate.get(key) || 0
      monthSeries.push(v)
      monthHeights.push(Math.max(6, Math.round(v / 60)))
      monthSum += v
    }
    let streak = 0
    for (let i = 0; i < 366; i++) {
      const dt = addDays(today, -i)
      const key = formatDateYMD(dt)
      const v = byDate.get(key) || 0
      if (v >= goal) streak += 1
      else break
    }
    let badge = '继续加油'
    if (streak >= 30) badge = '30天水饮大师'
    else if (streak >= 14) badge = '14天稳定补水'
    else if (streak >= 7) badge = '7天水饮达人'
    else if (streak >= 3) badge = '3天达标新星'
    this.setData({
      waterGoalMl: goal,
      waterHeightCm: Number.isFinite(heightCm) && heightCm > 0 ? String(Math.round(heightCm * 10) / 10) : '',
      waterWeightKg: Number.isFinite(weightKg) && weightKg > 0 ? String(Math.round(weightKg * 10) / 10) : '',
      waterActivityIndex: activityIndex,
      recommendedWaterGoal: recommendedGoal,
      todayWaterMl: todayWater,
      waterTodayPercent: Math.round(clampNumber((todayWater / goal) * 100, 0, 100)),
      waterWeekAvg: Math.round(weekSum / 7),
      waterMonthAvg: Math.round(monthSum / 30),
      waterStreakDays: streak,
      waterBadgeText: badge,
      waterWeekSeries: weekSeries,
      waterMonthSeries: monthSeries,
      waterWeekHeights: weekHeights,
      waterMonthHeights: monthHeights,
    })
  },
  async saveWaterSetting() {
    const openid = wx.getStorageSync('openid') || ''
    if (!openid) return
    const db = wx.cloud.database()
    const goal = clampNumber(parseInt(this.data.waterGoalMl || 2000, 10) || 2000, 500, 6000)
    const rawActivity = parseInt(this.data.waterActivityIndex, 10)
    const activityIndex = Number.isFinite(rawActivity) ? clampNumber(rawActivity, 0, 2) : 1
    const heightCm = this.data.waterHeightCm ? Number(this.data.waterHeightCm) : NaN
    const weightKg = this.data.waterWeightKg ? Number(this.data.waterWeightKg) : NaN
    const waterSetting = {
      goalMl: goal,
      activityIndex,
      heightCm: Number.isFinite(heightCm) ? Math.round(heightCm * 10) / 10 : null,
      weightKg: Number.isFinite(weightKg) ? Math.round(weightKg * 10) / 10 : null,
      updatedAt: Date.now(),
    }
    let lastErr = null
    try {
      await db.collection('water_setting').doc(openid).set({
        data: Object.assign({}, waterSetting, { createdAt: Date.now() }),
      })
      return
    } catch (e) { lastErr = e }
    try {
      await db.collection('user').doc(openid).update({ data: { waterSetting } })
      return
    } catch (e) { lastErr = e }
    try {
      await db.collection('user').doc(openid).set({
        data: {
          nickname: '用户' + (Math.random() + '').slice(2, 10),
          waterSetting,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      })
      return
    } catch (e) { lastErr = e }
    throw lastErr || new Error('保存失败')
  },
  onWaterGoalInput(e) {
    const v = ((e && e.detail && e.detail.value) || '').replace(/[^\d]/g, '')
    this.setData({ waterGoalMl: v ? clampNumber(parseInt(v, 10) || 0, 0, 6000) : '' })
  },
  onWaterHeightInput(e) {
    const v = ((e && e.detail && e.detail.value) || '').replace(/[^\d.]/g, '')
    this.setData({ waterHeightCm: v })
  },
  onWaterWeightInput(e) {
    const v = ((e && e.detail && e.detail.value) || '').replace(/[^\d.]/g, '')
    this.setData({ waterWeightKg: v })
  },
  onWaterActivityChange(e) {
    const raw = parseInt((e && e.detail && e.detail.value), 10)
    const idx = Number.isFinite(raw) ? clampNumber(raw, 0, 2) : 1
    const weightKg = Number(this.data.waterWeightKg || 0)
    const factor = this.data.waterActivityFactorList[idx] || 1.15
    const rec = clampNumber(roundTo50((weightKg > 0 ? weightKg * 30 : 2000) * factor), 1200, 4500)
    this.setData({ waterActivityIndex: idx, recommendedWaterGoal: rec })
  },
  useRecommendedWaterGoal() {
    this.setData({ waterGoalMl: this.data.recommendedWaterGoal || 2000 })
  },
  onWaterManualInput(e) {
    const v = ((e && e.detail && e.detail.value) || '').replace(/[^\d]/g, '')
    this.setData({ waterManualInput: v })
  },
  async saveTodayWater(total) {
    const openid = wx.getStorageSync('openid') || ''
    if (!openid) return
    const db = wx.cloud.database()
    const dateStr = this.data.todayDate || formatDateYMD(new Date())
    const docId = openid + '_' + dateStr
    const val = clampNumber(parseInt(total, 10) || 0, 0, 10000)
    try {
      await db.collection('diet_record').doc(docId).update({
        data: { drink_water: val, record_date: dateStr, update_time: db.serverDate() },
      })
    } catch (e) {
      await db.collection('diet_record').doc(docId).set({
        data: {
          record_date: dateStr,
          diet_tag: '',
          drink_water: val,
          has_snack: false,
          has_sugary: false,
          remark: '',
          create_time: db.serverDate(),
        },
      })
    }
  },
  async onQuickAddWater(e) {
    const amount = clampNumber(parseInt(e?.currentTarget?.dataset?.amount || 0, 10) || 0, 0, 2000)
    if (!amount) return
    const next = clampNumber((parseInt(this.data.todayWaterMl || 0, 10) || 0) + amount, 0, 10000)
    try {
      await this.saveTodayWater(next)
      await this.loadWaterReminderData()
      this.loadLatestHabitSummary()
      wx.showToast({ title: `+${amount}ml`, icon: 'success' })
    } catch (e2) {
      wx.showToast({ title: '记录失败', icon: 'none' })
    }
  },
  async onSaveManualWater() {
    const v = clampNumber(parseInt(this.data.waterManualInput || 0, 10) || 0, 0, 10000)
    if (!v) {
      wx.showToast({ title: '请输入饮水量', icon: 'none' })
      return
    }
    const next = clampNumber((parseInt(this.data.todayWaterMl || 0, 10) || 0) + v, 0, 10000)
    try {
      await this.saveTodayWater(next)
      this.setData({ waterManualInput: '' })
      await this.loadWaterReminderData()
      this.loadLatestHabitSummary()
      wx.showToast({ title: '已记录', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: '记录失败', icon: 'none' })
    }
  },
  async onSaveWaterSettings() {
    if (!(wx.getStorageSync('openid') || '')) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    if (!(Number(this.data.waterGoalMl) >= 500 && Number(this.data.waterGoalMl) <= 6000)) {
      wx.showToast({ title: '目标需在500~6000ml', icon: 'none' })
      return
    }
    const h = this.data.waterHeightCm ? Number(this.data.waterHeightCm) : NaN
    if (this.data.waterHeightCm && !(h >= 80 && h <= 250)) {
      wx.showToast({ title: '身高需在80~250cm', icon: 'none' })
      return
    }
    const w = this.data.waterWeightKg ? Number(this.data.waterWeightKg) : NaN
    if (this.data.waterWeightKg && !(w >= 20 && w <= 300)) {
      wx.showToast({ title: '体重需在20~300kg', icon: 'none' })
      return
    }
    try {
      await this.saveWaterSetting()
      await this.loadWaterReminderData()
      this.setData({ showWaterInput: false }, () => this.restoreChartCanvas())
      wx.showToast({ title: '设置已保存', icon: 'success' })
    } catch (e) {
      this.showSaveError('饮水设置保存失败', e)
    }
  },
  closeWaterInput() {
    this.setData({ showWaterInput: false }, () => this.restoreChartCanvas())
  },
  async loadSleepSettings() {
    const openid = wx.getStorageSync('openid') || ''
    if (!openid) return
    const db = wx.cloud.database()
    try {
      const [sRes, uRes] = await Promise.all([
        db.collection('sleep_setting').doc(openid).get().catch(() => null),
        db.collection('user').doc(openid).get().catch(() => null),
      ])
      const d = (sRes && sRes.data) ? sRes.data : ((uRes && uRes.data && uRes.data.sleepSetting) ? uRes.data.sleepSetting : null)
      if (d && d.bedtime && d.wakeTime) {
        this.setData({ sleepPlanBedtime: d.bedtime, sleepPlanWakeTime: d.wakeTime })
      }
    } catch (e) {}
  },
  onPlanBedtimeChange(e) {
    this.setData({ sleepPlanBedtime: (e && e.detail && e.detail.value) || '' })
  },
  onPlanWakeTimeChange(e) {
    this.setData({ sleepPlanWakeTime: (e && e.detail && e.detail.value) || '' })
  },
  closeSleepSettingInput() {
    this.setData({ showSleepSettingInput: false }, () => this.restoreChartCanvas())
  },
  async onSaveSleepSetting() {
    const openid = wx.getStorageSync('openid') || ''
    if (!openid) return
    if (!this.data.sleepPlanBedtime || !this.data.sleepPlanWakeTime) {
      wx.showToast({ title: '请先选择时间', icon: 'none' })
      return
    }
    const db = wx.cloud.database()
    try {
      const sleepSetting = {
        bedtime: this.data.sleepPlanBedtime,
        wakeTime: this.data.sleepPlanWakeTime,
        updatedAt: Date.now(),
      }
      try {
        await db.collection('sleep_setting').doc(openid).set({
          data: Object.assign({}, sleepSetting, { createdAt: Date.now() }),
        })
      } catch (e) {
        try {
        await db.collection('user').doc(openid).update({ data: { sleepSetting } })
        } catch (e2) {
          await db.collection('user').doc(openid).set({
            data: {
              nickname: '用户' + (Math.random() + '').slice(2, 10),
              sleepSetting,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          })
        }
      }
      this.setData({ showSleepSettingInput: false }, () => this.restoreChartCanvas())
      wx.showToast({ title: '作息设置已保存', icon: 'success' })
    } catch (e) {
      this.showSaveError('作息设置保存失败', e)
    }
  },
  onDietTagChange(e) {
    const idx = parseInt((e && e.detail && e.detail.value) || -1, 10)
    const opts = this.data.dietTagOptions || []
    this.setData({
      dietTagIndex: idx,
      dietTag: idx >= 0 && idx < opts.length ? opts[idx] : ''
    })
  },
  onDietWaterInput(e) {
    const v = (e && e.detail && e.detail.value) ? ('' + e.detail.value).replace(/[^\d]/g, '') : ''
    this.setData({ dietDrinkWater: v })
  },
  onDietSnackChange(e) {
    this.setData({ dietHasSnack: !!(e && e.detail && e.detail.value) })
  },
  onDietSugaryChange(e) {
    this.setData({ dietHasSugary: !!(e && e.detail && e.detail.value) })
  },
  onDietRemarkInput(e) {
    this.setData({ dietRemark: ((e && e.detail && e.detail.value) || '').slice(0, 50) })
  },
  restoreChartCanvas() {
    this._chart = null
    this._initChartCanvas()
  },
  onCancelDiet() {
    this.setData({ showDietInput: false }, () => this.restoreChartCanvas())
  },
  async onConfirmDiet() {
    const openid = wx.getStorageSync('openid') || ''
    if (!openid) {
      wx.setStorageSync('afterLoginTab', '/pages/chart/index')
      wx.switchTab({ url: '/pages/profile/index' })
      return
    }
    let water = parseInt(this.data.dietDrinkWater || '0', 10)
    if (isNaN(water) || water < 0) water = 0
    if (water > 10000) {
      wx.showToast({ title: '饮水量需在 0~10000ml', icon: 'none' })
      return
    }
    const dateStr = this.data.todayDate || formatDateYMD(new Date())
    const db = wx.cloud.database()
    const docId = openid + '_' + dateStr
    try {
      await db.collection('diet_record').doc(docId).set({
        data: {
          record_date: dateStr,
          diet_tag: this.data.dietTag || '',
          drink_water: water,
          has_snack: !!this.data.dietHasSnack,
          has_sugary: !!this.data.dietHasSugary,
          remark: this.data.dietRemark || '',
          create_time: db.serverDate()
        }
      })
      this.setData({ showDietInput: false }, () => this.restoreChartCanvas())
      this.loadLatestHabitSummary()
      wx.showToast({ title: '饮食已保存', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: '饮食保存失败，请稍后重试', icon: 'none' })
    }
  },
  onSleepTimeChange(e) {
    this.setData({ sleepTime: (e && e.detail && e.detail.value) ? e.detail.value : '' }, () => this.recalcSleepDerived())
  },
  onWakeTimeChange(e) {
    this.setData({ wakeTime: (e && e.detail && e.detail.value) ? e.detail.value : '' }, () => this.recalcSleepDerived())
  },
  onStayUpChange(e) {
    this.setData({ isStayUp: !!(e && e.detail && e.detail.value) }, () => this.recalcSleepDerived())
  },
  recalcSleepDerived() {
    const duration = calcDurationByTimes(this.data.sleepTime, this.data.wakeTime)
    const score = autoSleepQuality(duration || 0, this.data.sleepTime, !!this.data.isStayUp)
    this.setData({
      sleepDuration: duration ? ('' + duration) : '',
      sleepQuality: score || 0,
      sleepQualityText: sleepQualityText(score)
    })
  },
  onCancelSleep() {
    this.setData({ showSleepInput: false }, () => this.restoreChartCanvas())
  },
  async onConfirmSleep() {
    const openid = wx.getStorageSync('openid') || ''
    if (!openid) {
      wx.setStorageSync('afterLoginTab', '/pages/chart/index')
      wx.switchTab({ url: '/pages/profile/index' })
      return
    }
    let duration = parseFloat(this.data.sleepDuration || '0')
    if (isNaN(duration) || duration < 0 || duration > 24) {
      wx.showToast({ title: '睡眠时长需在 0~24 小时', icon: 'none' })
      return
    }
    duration = Math.round(duration * 2) / 2
    if (!this.data.sleepTime || !this.data.wakeTime) {
      wx.showToast({ title: '请先选择入睡和起床时间', icon: 'none' })
      return
    }
    const quality = parseInt(this.data.sleepQuality || 0, 10)
    const dateStr = this.data.todayDate || formatDateYMD(new Date())
    const db = wx.cloud.database()
    const docId = openid + '_' + dateStr
    try {
      await db.collection('sleep_record').doc(docId).set({
        data: {
          record_date: dateStr,
          sleep_time: this.data.sleepTime || '',
          wake_time: this.data.wakeTime || '',
          sleep_duration: duration,
          sleep_quality: quality,
          is_stay_up: !!this.data.isStayUp,
          create_time: db.serverDate()
        }
      })
      this.setData({ showSleepInput: false, sleepDuration: '' + duration }, () => this.restoreChartCanvas())
      this.loadLatestHabitSummary()
      wx.showToast({ title: '作息已保存', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: '作息保存失败，请稍后重试', icon: 'none' })
    }
  },

  onChartTouchStart(e) {
    const x = e?.touches?.[0]?.x
    if (typeof x !== 'number') return
    const idx = this._pickIndexFromTouch(x)
    this.setData({ activeIndex: idx }, () => this._renderChart())
  },

  onChartTouchMove(e) {
    const x = e?.touches?.[0]?.x
    if (typeof x !== 'number') return
    const idx = this._pickIndexFromTouch(x)
    if (idx === this.data.activeIndex) return
    this.setData({ activeIndex: idx }, () => this._renderChart())
  },

  onChartTouchEnd() {
    this.setData({ activeIndex: -1 }, () => this._renderChart())
  },
})
