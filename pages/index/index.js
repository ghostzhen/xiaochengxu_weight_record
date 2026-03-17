// 体重记录首页
function pad(n) { return n < 10 ? ('0' + n) : ('' + n) }
function formatDate(y, m, d) { return y + '-' + pad(m) + '-' + pad(d) }
function addDays(dt, n) {
  var t = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
  t.setDate(t.getDate() + n)
  return t
}
function cleanDecimalInput(raw, decimalLen) {
  var s = (raw || '').replace(/[^\d.]/g, '')
  var firstDot = s.indexOf('.')
  if (firstDot >= 0) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '')
    if (decimalLen >= 0) {
      var p = s.split('.')
      s = p[0] + '.' + (p[1] || '').slice(0, decimalLen)
    }
  }
  return s
}
function buildCalendarRows(year, month) {
  var first = new Date(year, month - 1, 1)
  var firstWeekday = first.getDay()
  var days = new Date(year, month, 0).getDate()
  var rows = []
  var row = []
  var i
  for (i = 0; i < firstWeekday; i++) row.push('')
  for (var day = 1; day <= days; day++) {
    row.push(day)
    if (row.length === 7) {
      rows.push(row)
      row = []
    }
  }
  if (row.length) {
    while (row.length < 7) row.push('')
    rows.push(row)
  }
  return rows
}

Page({
  data: {
    monthYear: '',
    viewYear: 0,
    viewMonth: 0,
    selectedDay: 1,
    calendarRows: [],
    unit: 'kg',
    unitLabel: '公斤',
    targetWeight: 0,
    goalPercent: 0,
    goalSubText: '',
    goalColor: '#3DC466',
    historyVsInitial: '',
    historyVsLastMonth: '',
    latestWeight: 0,
    initialWeight: 0,
    goalRemain: 0,
    goalAchieved: 0,
    goalDaysLeft: 0,
    statusLabel: '',
    latestTag: '今日',
    latestDate: '',
    initialDate: '',
    selectedDate: '',
    selectedWeight: 0,
    streakDays: 0,
    recent7Done: false,
    streakHint: '',
    showWeightInput: false,
    inputWeight: '',
    showTargetInput: false,
    inputTargetWeight: ''
  },

  onLoad: function () {
    var now = new Date()
    var y = now.getFullYear()
    var m = now.getMonth() + 1
    var d = now.getDate()
    this.setData({
      monthYear: m + '月 ' + y,
      viewYear: y,
      viewMonth: m,
      selectedDay: d,
      calendarRows: buildCalendarRows(y, m),
      latestWeight: 0,
      initialWeight: 0,
      latestDate: formatDate(y, m, d),
      selectedDate: formatDate(y, m, d),
      selectedWeight: 0
    })
    this.ensureLoginThenLoad(y, m, d)
  },
  onShow: function () {
    var y = this.data.viewYear
    var m = this.data.viewMonth
    var d = this.data.selectedDay
    if (!y || !m) {
      var now = new Date()
      y = now.getFullYear()
      m = now.getMonth() + 1
      d = now.getDate()
      this.setData({ viewYear: y, viewMonth: m, monthYear: m + '月 ' + y, selectedDay: d, calendarRows: buildCalendarRows(y, m) })
    }
    this.ensureLoginThenLoad(y, m, d)
  },
  getOpenid: function () {
    var openid = wx.getStorageSync('openid')
    return Promise.resolve(openid || '')
  },
  ensureLoginThenLoad: function (y, m, d) {
    var cached = wx.getStorageSync('userRegistered')
    if (!cached) return
    var that = this
    this.getOpenid().then(function (openid) {
      if (!openid) return
      that.loadAllWeights(openid, y, m, d)
      that.loadTargetWeight(openid)
    }).catch(function () {})
  },
  loadAllWeights: function (openid, y, m, d) {
    if (!openid) return
    var that = this
    var db = wx.cloud.database()
    var limit = 20
    var all = []
    function fetchPage(skip) {
      return db.collection('weight_records')
        .where({ _openid: openid })
        .skip(skip)
        .limit(limit)
        .get()
        .then(function (res) {
          var list = (res && res.data) ? res.data : []
          all = all.concat(list)
          if (list.length === limit) return fetchPage(skip + limit)
          return null
        })
    }
    fetchPage(0).then(function () {
      var latest = null
      var initial = null
      var map = {}
      for (var i = 0; i < all.length; i++) {
        var r = all[i]
        if (!r || !r.date) continue
        map[r.date] = r.weight
        if (!latest || r.date > latest.date) latest = r
        if (!initial || r.date < initial.date) initial = r
      }
      that._weightsByDate = map
      var selectedDateStr = formatDate(y, m, d)
      that.setData({
        latestWeight: latest ? latest.weight : 0,
        latestDate: latest ? latest.date : '',
        initialWeight: initial ? initial.weight : 0,
        initialDate: initial ? initial.date : '',
        selectedDate: selectedDateStr,
        selectedWeight: map[selectedDateStr] || 0
      }, function () {
        that.recalcHistoryAndStreak()
        that.recalcGoal()
      })
    }).catch(function () {})
  },
  loadTargetWeight: function (openid) {
    if (!openid) return
    var that = this
    var db = wx.cloud.database()
    db.collection('target_weight').doc(openid).get().then(function (res) {
      var data = (res && res.data) ? res.data : null
      if (!data || typeof data.targetWeight === 'undefined') return
      that.setData({ targetWeight: data.targetWeight || 0 }, function () {
        that.recalcGoal()
      })
    }).catch(function () {})
  },
  recalcGoal: function () {
    var initial = parseFloat(this.data.initialWeight) || 0
    var latest = parseFloat(this.data.latestWeight) || 0
    var target = parseFloat(this.data.targetWeight) || 0

    if (!target || target <= 0) {
      this.setData({
        goalPercent: 0,
        goalSubText: '未设置目标体重',
        goalColor: '#bbb',
        goalRemain: 0,
        goalAchieved: 0,
        goalDaysLeft: 0,
        statusLabel: ''
      })
      return
    }

    if (!latest || latest <= 0) {
      this.setData({
        goalPercent: 0,
        goalSubText: '请先记录体重',
        goalColor: '#bbb',
        goalRemain: 0,
        goalAchieved: 0,
        goalDaysLeft: 0,
        statusLabel: ''
      })
      return
    }

    if (!initial || initial <= 0) initial = latest

    var diff = latest - target
    var diffJin = this.data.unit === 'kg' ? diff * 2 : diff
    var diffText = (Math.round(Math.abs(diffJin) * 10) / 10).toFixed(1)

    var total = Math.abs(target - initial)
    var done = Math.abs(latest - initial)
    var percent = total === 0 ? (latest === target ? 100 : 0) : (done / total) * 100
    var achieved = 0
    var remain = 0
    var sub = ''
    var status = ''

    if (latest > initial) achieved = latest - initial
    else achieved = initial - latest
    remain = Math.abs(latest - target)

    if (percent < 0) percent = 0
    if (percent > 100) percent = 100

    if (diff > 0) {
      sub = '还需减重 ' + diffText + ' 斤'
      status = '进行中'
    } else if (diff < 0) {
      sub = '还需增重 ' + diffText + ' 斤'
      status = '进行中'
    } else {
      sub = '已达成目标'
      status = '已达成'
    }

    var color = target >= initial ? '#2E7DFF' : '#3DC466'
    this.setData({
      goalPercent: Math.round(percent),
      goalSubText: sub,
      goalColor: color,
      goalRemain: Math.max(0, Math.round(remain * 10) / 10),
      goalAchieved: Math.max(0, Math.round(achieved * 10) / 10),
      goalDaysLeft: 0,
      statusLabel: status
    })
  },

  formatDelta: function (deltaKg) {
    if (typeof deltaKg !== 'number' || isNaN(deltaKg)) return '--'
    var u = this.data.unit
    var v = u === 'kg' ? deltaKg : (deltaKg * 2)
    var sign = v > 0 ? '+' : (v < 0 ? '-' : '')
    var abs = Math.abs(v)
    return sign + (Math.round(abs * 10) / 10).toFixed(1) + (u === 'kg' ? 'kg' : '斤')
  },
  pickRangeFirstLast: function (startDt, endDt) {
    var map = this._weightsByDate || {}
    var first = null
    var last = null
    var cur = new Date(startDt.getFullYear(), startDt.getMonth(), startDt.getDate())
    var end = new Date(endDt.getFullYear(), endDt.getMonth(), endDt.getDate())
    while (cur.getTime() <= end.getTime()) {
      var key = formatDate(cur.getFullYear(), cur.getMonth() + 1, cur.getDate())
      var v = map[key]
      var nv = parseFloat(v)
      if (typeof v !== 'undefined' && !isNaN(nv) && nv > 0) {
        if (!first) first = { date: key, weight: nv }
        last = { date: key, weight: nv }
      }
      cur = addDays(cur, 1)
    }
    return { first: first, last: last }
  },
  getWeekStart: function (dt) {
    var d = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
    var day = d.getDay()
    var offset = (day + 6) % 7
    return addDays(d, -offset)
  },
  recalcHistoryAndStreak: function () {
    var map = this._weightsByDate || {}
    var latestW = parseFloat(this.data.latestWeight) || 0
    var initialW = parseFloat(this.data.initialWeight) || 0
    if (!initialW || initialW <= 0) initialW = latestW

    var now = new Date()
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    var recent7Count = 0
    for (var i = 0; i < 7; i++) {
      var dt = addDays(today, -i)
      var key = formatDate(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
      var w = parseFloat(map[key])
      if (w && !isNaN(w) && w > 0) recent7Count++
    }

    var recent7Done = recent7Count === 7
    var hint = recent7Done ? '近7天已完成打卡，继续保持' : ('还差 ' + (7 - recent7Count) + ' 天达成近7天全勤')

    var last30 = addDays(today, -30)
    var last30Key = formatDate(last30.getFullYear(), last30.getMonth() + 1, last30.getDate())
    var w30 = parseFloat(map[last30Key])
    var vsLastMonth = (w30 && !isNaN(w30)) ? (latestW - w30) : NaN

    this.setData({
      streakDays: recent7Count,
      recent7Done: recent7Done,
      streakHint: hint,
      historyVsInitial: this.formatDelta(latestW - initialW),
      historyVsLastMonth: isNaN(vsLastMonth) ? '--' : this.formatDelta(vsLastMonth)
    })
  },

  onSwitchUnit: function (e) {
    var u = e.currentTarget.dataset.unit
    var label = u === 'kg' ? '公斤' : '斤'
    var that = this
    this.setData({ unit: u, unitLabel: label }, function () {
      that.recalcHistoryAndStreak()
      that.recalcGoal()
    })
  },

  onSelectDay: function (e) {
    var day = e.currentTarget.dataset.day
    if (!day) return
    var y = this.data.viewYear
    var m = this.data.viewMonth
    this.setData({ selectedDay: day })
    var dateStr = formatDate(y, m, day)
    var map = this._weightsByDate || {}
    this.setData({
      selectedDate: dateStr,
      selectedWeight: map[dateStr] || 0
    })
    if (!this._weightsByDate) this.ensureLoginThenLoad(y, m, day)
  },

  onPrevMonth: function () {
    var y = this.data.viewYear
    var m = this.data.viewMonth
    if (!y || !m) return
    m -= 1
    if (m <= 0) { m = 12; y -= 1 }
    this.applyMonth(y, m)
  },
  onNextMonth: function () {
    var y = this.data.viewYear
    var m = this.data.viewMonth
    if (!y || !m) return
    m += 1
    if (m > 12) { m = 1; y += 1 }
    this.applyMonth(y, m)
  },
  applyMonth: function (y, m) {
    var days = new Date(y, m, 0).getDate()
    var d = this.data.selectedDay || 1
    if (d > days) d = days
    var dateStr = formatDate(y, m, d)
    var map = this._weightsByDate || {}
    var that = this
    this.setData({
      viewYear: y,
      viewMonth: m,
      monthYear: m + '月 ' + y,
      calendarRows: buildCalendarRows(y, m),
      selectedDay: d,
      selectedDate: dateStr,
      selectedWeight: map[dateStr] || 0
    }, function () {
      that.ensureLoginThenLoad(y, m, d)
    })
  },

  onSmartReport: function () {
    var map = this._weightsByDate || {}
    var now = new Date()
    var list = []
    for (var i = 0; i < 7; i++) {
      var dt = addDays(now, -(6 - i))
      var key = formatDate(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
      var w = parseFloat(map[key])
      list.push({ d: key, w: (w && !isNaN(w) ? w : null) })
    }
    var count = 0
    var first = null
    var last = null
    var min = null
    var max = null
    for (var j = 0; j < list.length; j++) {
      var vv = list[j].w
      if (typeof vv !== 'number' || isNaN(vv)) continue
      count++
      if (!first) first = vv
      last = vv
      if (min === null || vv < min) min = vv
      if (max === null || vv > max) max = vv
    }
    if (!count) {
      wx.showModal({ title: '智能周报', content: '近7天暂无体重记录', showCancel: false })
      return
    }
    var delta = last - first
    var msg = ''
    var mul = this.data.unit === 'kg' ? 1 : 2
    var unitText = this.data.unit === 'kg' ? 'kg' : '斤'
    msg += '近7天记录 ' + count + ' 天\n'
    msg += '净变化 ' + this.formatDelta(delta) + '\n'
    msg += '最高 ' + (Math.round(max * mul * 10) / 10).toFixed(1) + unitText + '\n'
    msg += '最低 ' + (Math.round(min * mul * 10) / 10).toFixed(1) + unitText + '\n'
    msg += '波动 ' + (Math.round((max - min) * mul * 10) / 10).toFixed(1) + unitText
    wx.showModal({ title: '智能周报', content: msg, showCancel: false })
  },

  onBodyData: function () {
    var w = this.data.latestWeight || ''
    var date = this.data.latestDate || ''
    wx.navigateTo({ url: '/pages/bmi/index?weight=' + w + '&date=' + date })
  },

  onSetTargetWeight: function () {
    var cached = wx.getStorageSync('userRegistered')
    if (!cached) {
      wx.setStorageSync('afterLoginTab', '/pages/index/index')
      wx.switchTab({ url: '/pages/profile/index' })
      return
    }
    var openid = wx.getStorageSync('openid') || ''
    if (!openid) {
      wx.setStorageSync('afterLoginTab', '/pages/index/index')
      wx.switchTab({ url: '/pages/profile/index' })
      return
    }
    this.setData({
      showTargetInput: true,
      inputTargetWeight: this.data.targetWeight ? ('' + this.data.targetWeight) : ''
    })
  },
  onTargetInput: function (e) {
    var raw = (e && e.detail && e.detail.value) ? e.detail.value : ''
    this.setData({ inputTargetWeight: cleanDecimalInput(raw, 1) })
  },
  onConfirmTarget: function () {
    var that = this
    var input = (this.data.inputTargetWeight || '').trim()
    if (!input) {
      wx.showToast({ title: '请输入目标体重，例如 65.0', icon: 'none' })
      return
    }
    if (!/^\d+(\.\d{1})?$/.test(input)) {
      wx.showToast({ title: '目标体重最多保留 1 位小数', icon: 'none' })
      return
    }
    var val = parseFloat(input)
    if (isNaN(val) || val < 20 || val > 300) {
      wx.showToast({ title: '目标体重需在 20~300 之间', icon: 'none' })
      return
    }
    var openid = wx.getStorageSync('openid') || ''
    if (!openid) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    var db = wx.cloud.database()
    db.collection('target_weight').doc(openid).set({
      data: {
        targetWeight: val,
        updatedAt: Date.now(),
        createdAt: Date.now()
      }
    }).then(function () {
      that.setData({
        targetWeight: val,
        showTargetInput: false,
        inputTargetWeight: ''
      }, function () {
        that.recalcGoal()
      })
      wx.showToast({ title: '已保存', icon: 'success' })
    }).catch(function () {
      wx.showToast({ title: '保存失败', icon: 'none' })
    })
  },
  onCancelTarget: function () {
    this.setData({ showTargetInput: false, inputTargetWeight: '' })
  },

  onRecordWeight: function () {
    var cached = wx.getStorageSync('userRegistered')
    if (!cached) {
      wx.setStorageSync('afterLoginTab', '/pages/index/index')
      wx.switchTab({ url: '/pages/profile/index' })
      return
    }
    var now = new Date()
    var y = this.data.viewYear || now.getFullYear()
    var m = this.data.viewMonth || (now.getMonth() + 1)
    var d = this.data.selectedDay || now.getDate()
    var selectedDateStr = formatDate(y, m, d)
    var todayStr = formatDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
    if (selectedDateStr < todayStr) {
      wx.showToast({ title: '补卡功能暂不支持，等待后续开发', icon: 'none' })
      return
    }
    if (selectedDateStr > todayStr) {
      wx.showToast({ title: '仅支持记录当天体重', icon: 'none' })
      return
    }
    this.setData({ showWeightInput: true, inputWeight: '' })
  },
  onWeightInput: function (e) {
    var raw = (e && e.detail && e.detail.value) ? e.detail.value : ''
    this.setData({ inputWeight: cleanDecimalInput(raw, 1) })
  },
  onConfirmWeight: function () {
    var that = this
    var input = (this.data.inputWeight || '').trim()
    if (!input) {
      wx.showToast({ title: '请输入体重，例如 63.5', icon: 'none' })
      return
    }
    if (!/^\d+(\.\d{1})?$/.test(input)) {
      wx.showToast({ title: '体重最多保留 1 位小数', icon: 'none' })
      return
    }
    var val = parseFloat(input)
    if (isNaN(val) || val < 20 || val > 300) {
      wx.showToast({ title: '体重需在 20~300 之间', icon: 'none' })
      return
    }
    var now = new Date()
    var y = this.data.viewYear || now.getFullYear()
    var m = this.data.viewMonth || (now.getMonth() + 1)
    var d = this.data.selectedDay || now.getDate()
    var selectedDateStr = formatDate(y, m, d)
    var todayStr = formatDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
    if (selectedDateStr < todayStr) {
      wx.showToast({ title: '补卡功能暂不支持，等待后续开发', icon: 'none' })
      return
    }
    if (selectedDateStr > todayStr) {
      wx.showToast({ title: '仅支持记录当天体重', icon: 'none' })
      return
    }
    var dateStr = selectedDateStr
    this.getOpenid().then(function (openid) {
      if (!openid) return Promise.reject()
      var db = wx.cloud.database()
      var docId = openid + '_' + dateStr
      return db.collection('weight_records').doc(docId).set({
        data: { date: dateStr, weight: val, updatedAt: Date.now(), createdAt: Date.now() }
      }).then(function () { return openid })
    }).then(function (openid) {
      that.setData({
        showWeightInput: false,
        inputWeight: ''
      })
      that.loadAllWeights(openid, y, m, d)
      wx.showToast({ title: '已保存', icon: 'success' })
    }).catch(function () {
      wx.showToast({ title: '保存失败', icon: 'none' })
    })
  },
  onCancelWeight: function () {
    this.setData({ showWeightInput: false, inputWeight: '' })
  }
})
