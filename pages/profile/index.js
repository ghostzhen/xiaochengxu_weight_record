function pad(n) { return n < 10 ? ('0' + n) : ('' + n) }
function formatDate(dt) { return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()) }
function addDays(dt, n) {
  var t = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
  t.setDate(t.getDate() + n)
  return t
}
function getWeekStart(dt) {
  var d = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
  var day = d.getDay()
  var offset = (day + 6) % 7
  return addDays(d, -offset)
}

Page({
  data: {
    avatarLocalPath: '',
    avatarPreview: '',
    nickname: '用户昵称',
    existingUser: null,
    loggedIn: false,
    weekWeighCount: 0,
    currentWeight: '--',
    streakDays: 0,
    todayWeightRecorded: false,
    todayStr: '',
    featureItems: [
      { key: 'profile', icon: '📝', name: '个人信息', desc: '查看/编辑身高、目标、账号安全', dot: false },
      { key: 'weight', icon: '⚖️', name: '称重提醒', desc: '设置时间、周期、打卡统计', dot: false },
      { key: 'water', icon: '💧', name: '饮水提醒', desc: '目标设置、记录、进度条', dot: false },
      { key: 'sleep', icon: '🌙', name: '作息提醒', desc: '睡眠计划、统计、建议', dot: false },
      { key: 'more', icon: '⚙️', name: '更多设置', desc: '单位、主题、隐私、帮助', dot: false }
    ],
    showProfileEditor: false,
    editNickname: '',
    editHeightCm: '',
    editTargetWeight: '',
    genderOptions: ['未设置', '男', '女'],
    editGenderIndex: 0,
    editBirthDate: '',
    maxBirthDate: ''
  },
  onLoad: function () {
    this.setData({ maxBirthDate: formatDate(new Date()) })
  },
  onShow: function () {
    var app = getApp()
    var that = this
    var p = (app && typeof app.ensureAutoLogin === 'function')
      ? app.ensureAutoLogin()
      : Promise.resolve(wx.getStorageSync('openid') || '')
    p.then(function () {
      that.refreshLoginState()
    }).catch(function () {
      that.refreshLoginState()
    })
  },
  refreshLoginState: function () {
    var openid = wx.getStorageSync('openid') || ''
    var registered = !!wx.getStorageSync('userRegistered')
    var loggedIn = !!openid && registered
    if (registered && !openid) wx.setStorageSync('userRegistered', false)
    this.setData({ loggedIn: loggedIn, todayStr: formatDate(new Date()) })
    if (loggedIn) {
      this.syncProfileFromCloud(openid)
      this.loadWeightSummary(openid)
    } else {
      this.setData({ weekWeighCount: 0, currentWeight: '--', streakDays: 0, todayWeightRecorded: false })
      this.updateWeightBadge(false)
    }
  },
  syncProfileFromCloud: function (openid) {
    if (!openid) return Promise.resolve()
    var that = this
    var db = wx.cloud.database()
    return db.collection('user').doc(openid).get().then(function (res) {
      var u = (res && res.data) ? res.data : null
      if (!u) return
      that.applyUserInfo(u)
    }).catch(function () {
      return db.collection('user').where({ _openid: openid }).limit(1).get().then(function (res) {
        var u = (res && res.data && res.data[0]) ? res.data[0] : null
        if (!u) return
        that.applyUserInfo(u)
      }).catch(function () {})
    })
  },
  applyUserInfo: function (u) {
    var nickname = (u && u.nickname) ? u.nickname : '用户昵称'
    var gender = (u && u.gender) || ''
    var idx = 0
    if (gender === '男') idx = 1
    if (gender === '女') idx = 2
    this.setData({
      avatarPreview: (u && u.avatarFileID) ? u.avatarFileID : this.data.avatarPreview,
      nickname: nickname,
      existingUser: u || null,
      editNickname: nickname,
      editHeightCm: (u && (typeof u.heightCm !== 'undefined')) ? ('' + u.heightCm) : '',
      editGenderIndex: idx,
      editBirthDate: (u && u.birthDate) ? u.birthDate : ''
    })
    var openid = wx.getStorageSync('openid') || ''
    if (!openid) return
    var that = this
    var db = wx.cloud.database()
    db.collection('target_weight').doc(openid).get().then(function (res) {
      var t = (res && res.data && typeof res.data.targetWeight !== 'undefined') ? res.data.targetWeight : ''
      that.setData({ editTargetWeight: t === '' ? '' : ('' + t) })
    }).catch(function () {})
  },
  loadWeightSummary: function (openid) {
    if (!openid) return
    var that = this
    var db = wx.cloud.database()
    var _ = db.command
    var today = new Date()
    var todayStr = formatDate(today)
    var startStr = formatDate(addDays(today, -120))
    db.collection('weight_records')
      .where({ _openid: openid, date: _.gte(startStr).and(_.lte(todayStr)) })
      .orderBy('date', 'desc')
      .get()
      .then(function (res) {
        var rows = (res && res.data) ? res.data : []
        var map = {}
        var latestWeight = '--'
        if (rows.length && typeof rows[0].weight !== 'undefined') latestWeight = '' + rows[0].weight + 'kg'
        for (var i = 0; i < rows.length; i++) {
          if (rows[i] && rows[i].date) map[rows[i].date] = rows[i].weight
        }
        var weekStart = getWeekStart(today)
        var count = 0
        var cursor = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate())
        while (cursor.getTime() <= today.getTime()) {
          var key = formatDate(cursor)
          var v = parseFloat(map[key])
          if (v && !isNaN(v) && v > 0) count++
          cursor = addDays(cursor, 1)
        }
        var streak = 0
        var latestDate = rows.length && rows[0].date ? rows[0].date : ''
        if (latestDate) {
          var dt = new Date(latestDate + 'T00:00:00')
          var safe = 0
          while (safe < 366) {
            var dk = formatDate(dt)
            var dv = parseFloat(map[dk])
            if (!(dv && !isNaN(dv) && dv > 0)) break
            streak++
            dt = addDays(dt, -1)
            safe++
          }
        }
        that.setData({
          weekWeighCount: count,
          currentWeight: latestWeight,
          streakDays: streak,
          todayWeightRecorded: !!map[todayStr]
        })
        that.updateWeightBadge(!map[todayStr])
      })
      .catch(function () {
        that.setData({ weekWeighCount: 0, currentWeight: '--', streakDays: 0, todayWeightRecorded: false })
        that.updateWeightBadge(false)
      })
  },
  updateWeightBadge: function (show) {
    var list = this.data.featureItems || []
    var next = []
    for (var i = 0; i < list.length; i++) {
      var item = list[i]
      next.push({
        key: item.key,
        icon: item.icon,
        name: item.name,
        desc: item.desc,
        dot: item.key === 'weight' ? !!show : !!item.dot
      })
    }
    this.setData({ featureItems: next })
    wx.removeTabBarBadge({ index: 0, fail: function () {} })
  },
  onChooseAvatar: function (e) {
    var avatarUrl = e && e.detail && e.detail.avatarUrl
    this.setData({
      avatarLocalPath: avatarUrl,
      avatarPreview: avatarUrl
    })
  },
  onFeatureTap: function (e) {
    var key = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.key : ''
    if (key === 'profile') {
      this.openProfileEditor()
      return
    }
    if (key === 'water') {
      wx.setStorageSync('chartAction', 'water')
      wx.switchTab({ url: '/pages/chart/index' })
      return
    }
    if (key === 'weight') {
      if (!this.data.todayWeightRecorded) {
        wx.showModal({
          title: '称重提醒',
          content: '今天还没有记录体重，是否现在去记录？',
          confirmText: '去记录',
          cancelText: '稍后',
          success: function (res) {
            if (res && res.confirm) wx.switchTab({ url: '/pages/index/index' })
          }
        })
      } else {
        wx.showToast({ title: '今日已记录体重', icon: 'success' })
      }
      return
    }
    if (key === 'sleep') {
      wx.setStorageSync('chartAction', 'sleep')
      wx.switchTab({ url: '/pages/chart/index' })
      return
    }
    if (key === 'more') {
      wx.navigateTo({ url: '/pages/settings/index' })
      return
    }
    var map = {
      weight: '称重提醒开发中',
      water: '饮水提醒开发中',
      sleep: '作息提醒开发中',
      more: '更多设置开发中'
    }
    wx.showToast({ title: map[key] || '功能开发中', icon: 'none' })
  },
  openProfileEditor: function () {
    var u = this.data.existingUser || {}
    var nick = (this.data.nickname || u.nickname || '').slice(0, 12)
    var g = u.gender || ''
    var idx = 0
    if (g === '男') idx = 1
    if (g === '女') idx = 2
    this.setData({
      showProfileEditor: true,
      editNickname: nick,
      editHeightCm: (typeof u.heightCm !== 'undefined' ? ('' + u.heightCm) : this.data.editHeightCm),
      editTargetWeight: this.data.editTargetWeight || '',
      editGenderIndex: idx,
      editBirthDate: u.birthDate || this.data.editBirthDate || ''
    })
  },
  onCloseEditor: function () {
    this.setData({ showProfileEditor: false })
  },
  onEditInput: function (e) {
    var field = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.field : ''
    var val = (e && e.detail && typeof e.detail.value !== 'undefined') ? ('' + e.detail.value) : ''
    if (field === 'editNickname') val = val.replace(/\s+/g, ' ').trim().slice(0, 12)
    if (field === 'editHeightCm' || field === 'editTargetWeight') val = val.replace(/[^\d.]/g, '')
    var next = {}
    next[field] = val
    this.setData(next)
  },
  onGenderChange: function (e) {
    var idx = parseInt((e && e.detail && e.detail.value) || 0, 10)
    if (isNaN(idx) || idx < 0) idx = 0
    if (idx > 2) idx = 2
    this.setData({ editGenderIndex: idx })
  },
  onBirthDateChange: function (e) {
    this.setData({ editBirthDate: (e && e.detail && e.detail.value) ? e.detail.value : '' })
  },
  noop: function () {},
  onSaveProfile: function () {
    var openid = wx.getStorageSync('openid') || ''
    if (!openid) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    var nickname = (this.data.editNickname || '').replace(/\s+/g, ' ').trim().slice(0, 12)
    if (!nickname) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    var height = this.data.editHeightCm ? parseFloat(this.data.editHeightCm) : NaN
    if (this.data.editHeightCm && (isNaN(height) || height < 80 || height > 250)) {
      wx.showToast({ title: '身高需在 80~250cm', icon: 'none' })
      return
    }
    var target = this.data.editTargetWeight ? parseFloat(this.data.editTargetWeight) : NaN
    if (this.data.editTargetWeight && (isNaN(target) || target < 20 || target > 300)) {
      wx.showToast({ title: '目标体重需在 20~300kg', icon: 'none' })
      return
    }
    var that = this
    var db = wx.cloud.database()
    var existing = this.data.existingUser || null
    var gender = this.data.genderOptions[this.data.editGenderIndex] || '未设置'
    var userData = {
      nickname: nickname,
      gender: gender === '未设置' ? '' : gender,
      birthDate: this.data.editBirthDate || '',
      updatedAt: Date.now()
    }
    if (this.data.editHeightCm) userData.heightCm = Math.round(height * 10) / 10
    var uploadPromise = Promise.resolve('')
    var localAvatar = this.data.avatarLocalPath || ''
    if (localAvatar && localAvatar.indexOf('cloud://') !== 0) {
      var ext = '.png'
      var m = localAvatar.match(/\.(jpg|jpeg|png|webp|gif)$/i)
      if (m && m[1]) ext = '.' + m[1].toLowerCase()
      uploadPromise = wx.cloud.uploadFile({
        cloudPath: 'avatar/' + openid + '_' + Date.now() + ext,
        filePath: localAvatar
      }).then(function (up) {
        return (up && up.fileID) ? up.fileID : ''
      }).catch(function () { return '' })
    }
    uploadPromise.then(function (fileID) {
      if (fileID) userData.avatarFileID = fileID
      var docId = (existing && existing._id) ? existing._id : openid
      var saveUser = existing
        ? db.collection('user').doc(docId).update({ data: userData })
        : db.collection('user').doc(openid).set({ data: Object.assign({}, userData, { createdAt: Date.now() }) })
      return saveUser.then(function () { return fileID }).catch(function () {
        return db.collection('user').doc(openid).set({ data: Object.assign({}, userData, { createdAt: Date.now() }) }).then(function () { return fileID })
      })
    }).then(function () {
      if (that.data.editTargetWeight) {
        return db.collection('target_weight').doc(openid).set({
          data: {
            targetWeight: Math.round(target * 10) / 10,
            updatedAt: Date.now(),
            createdAt: Date.now()
          }
        })
      }
      return Promise.resolve()
    }).then(function () {
      that.setData({
        showProfileEditor: false,
        nickname: nickname,
        avatarLocalPath: ''
      })
      that.syncProfileFromCloud(openid)
      wx.showToast({ title: '已保存', icon: 'success' })
    }).catch(function () {
      wx.showToast({ title: '保存失败', icon: 'none' })
    })
  }
})
