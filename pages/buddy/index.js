function pad(n) {
  return n < 10 ? ('0' + n) : ('' + n)
}

function formatDate(dt) {
  return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate())
}

function formatTime(dt) {
  return pad(dt.getHours()) + ':' + pad(dt.getMinutes())
}

function parseYmd(ymd) {
  if (!ymd || typeof ymd !== 'string') return null
  var p = ymd.split('-')
  if (p.length !== 3) return null
  var y = parseInt(p[0], 10)
  var m = parseInt(p[1], 10)
  var d = parseInt(p[2], 10)
  if (!(y > 0 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null
  return new Date(y, m - 1, d)
}

function addDays(dt, n) {
  var t = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
  t.setDate(t.getDate() + n)
  return t
}

function getOpenidTail(openid) {
  if (!openid || typeof openid !== 'string') return '----'
  if (openid.length <= 4) return openid
  return openid.slice(-4)
}

async function fetchCollectionAll(db, collectionName, options) {
  var limit = (options && options.limit) || 100
  var where = (options && options.where) || null
  var orderByField = options && options.orderByField
  var orderByOrder = (options && options.orderByOrder) || 'asc'
  var skip = 0
  var all = []
  while (true) {
    var query = db.collection(collectionName)
    if (where) query = query.where(where)
    if (orderByField) query = query.orderBy(orderByField, orderByOrder)
    var res = await query.skip(skip).limit(limit).get()
    var rows = (res && res.data) ? res.data : []
    all = all.concat(rows)
    if (rows.length < limit) break
    skip += limit
  }
  return all
}

Page({
  data: {
    loading: false,
    errorText: '',
    rankList: [],
    myRank: 0,
    myItem: null,
    totalUsers: 0,
    updatedAtText: ''
  },
  onShow: function () {
    this.loadLeaderboard()
  },
  onPullDownRefresh: function () {
    var that = this
    this.loadLeaderboard().then(function () {
      wx.stopPullDownRefresh()
    }).catch(function () {
      wx.stopPullDownRefresh()
    })
  },
  loadLeaderboard: async function () {
    var that = this
    var openid = wx.getStorageSync('openid') || ''
    this.setData({ loading: true, errorText: '' })
    try {
      var db = wx.cloud.database()
      var users = await fetchCollectionAll(db, 'user', { limit: 100 })
      var weightRows = await fetchCollectionAll(db, 'weight_records', { limit: 100 })
      var userMap = {}
      for (var i = 0; i < users.length; i++) {
        var u = users[i]
        var k = (u && u._openid) ? u._openid : ''
        if (!k) continue
        userMap[k] = u
      }
      var dateSetMap = {}
      var latestDateMap = {}
      for (var j = 0; j < weightRows.length; j++) {
        var r = weightRows[j]
        var uid = r && r._openid ? r._openid : ''
        var date = r && r.date ? r.date : ''
        var w = parseFloat(r && r.weight)
        if (!uid || !date || !(w > 0)) continue
        if (!dateSetMap[uid]) dateSetMap[uid] = {}
        dateSetMap[uid][date] = true
        if (!latestDateMap[uid] || date > latestDateMap[uid]) latestDateMap[uid] = date
      }

      var list = []
      var keys = Object.keys(dateSetMap)
      for (var m = 0; m < keys.length; m++) {
        var uid2 = keys[m]
        var latest = latestDateMap[uid2] || ''
        var latestDt = parseYmd(latest)
        if (!latestDt) continue
        var streak = 0
        var safe = 0
        while (safe < 1000) {
          var key = formatDate(addDays(latestDt, -streak))
          if (!dateSetMap[uid2][key]) break
          streak += 1
          safe += 1
        }
        if (streak <= 0) continue
        var user = userMap[uid2] || null
        var nickname = (user && user.nickname) ? user.nickname : ('用户' + getOpenidTail(uid2))
        var avatar = (user && user.avatarFileID) ? user.avatarFileID : ''
        list.push({
          openid: uid2,
          nickname: nickname,
          avatarText: nickname ? nickname.slice(0, 1) : '用',
          avatar: avatar,
          streakDays: streak,
          latestDate: latest
        })
      }

      list.sort(function (a, b) {
        if (b.streakDays !== a.streakDays) return b.streakDays - a.streakDays
        if (b.latestDate !== a.latestDate) return b.latestDate > a.latestDate ? 1 : -1
        return (a.nickname || '').localeCompare(b.nickname || '')
      })

      for (var n = 0; n < list.length; n++) {
        list[n].rank = n + 1
      }

      var myRank = 0
      var myItem = null
      if (openid) {
        for (var p = 0; p < list.length; p++) {
          if (list[p].openid === openid) {
            myRank = list[p].rank
            myItem = list[p]
            break
          }
        }
      }

      that.setData({
        loading: false,
        errorText: '',
        rankList: list.slice(0, 100),
        myRank: myRank,
        myItem: myItem,
        totalUsers: list.length,
        updatedAtText: formatTime(new Date())
      })
    } catch (e) {
      that.setData({
        loading: false,
        errorText: '加载失败，请稍后重试',
        rankList: [],
        myRank: 0,
        myItem: null,
        totalUsers: 0,
        updatedAtText: ''
      })
    }
  }
})
