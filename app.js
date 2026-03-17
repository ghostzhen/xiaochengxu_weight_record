// 应用入口
// - 初始化云开发环境
// - 仅初始化云环境，不在启动时自动获取 openid
App({
  globalData: {
    openid: ''
  },
  _autoLoginPromise: null,
  randomUserSuffix: function (len) {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    var out = ''
    for (var i = 0; i < len; i++) {
      out += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return out
  },
  ensureAutoLogin: function () {
    if (this._autoLoginPromise) return this._autoLoginPromise
    var that = this
    this._autoLoginPromise = wx.cloud.callFunction({ name: 'getOpenid' }).then(function (res) {
      var openid = (res && res.result && (res.result.openid || res.result.openId || (res.result.userInfo && res.result.userInfo.openId))) || ''
      if (!openid) {
        wx.setStorageSync('userRegistered', false)
        return ''
      }
      that.globalData.openid = openid
      wx.setStorageSync('openid', openid)
      var db = wx.cloud.database()
      return db.collection('user').where({ _openid: openid }).limit(1).get().then(function (queryRes) {
        var existing = (queryRes && queryRes.data && queryRes.data[0]) ? queryRes.data[0] : null
        var nickname = '用户' + that.randomUserSuffix(8)
        if (existing && existing._id) {
          wx.setStorageSync('userRegistered', true)
          if (existing.nickname) return openid
          return db.collection('user').doc(existing._id).update({
            data: {
              nickname: nickname,
              updatedAt: Date.now()
            }
          }).then(function () { return openid }).catch(function () { return openid })
        }
        return db.collection('user').doc(openid).set({
          data: {
            nickname: nickname,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        }).then(function () {
          wx.setStorageSync('userRegistered', true)
          return openid
        }).catch(function () {
          wx.setStorageSync('userRegistered', false)
          return ''
        })
      })
    }).catch(function () {
      wx.setStorageSync('userRegistered', false)
      return ''
    }).then(function (openid) {
      that._autoLoginPromise = null
      return openid
    }, function () {
      that._autoLoginPromise = null
      return ''
    })
    return this._autoLoginPromise
  },
  onLaunch(){
    wx.cloud.init({
      env:"cloud1-9ghbta8g727e619f"
    })
    wx.removeStorageSync('afterLoginTab')
    var openid = wx.getStorageSync('openid') || ''
    var registered = !!wx.getStorageSync('userRegistered')
    this.globalData.openid = openid
    if (openid && !registered) wx.setStorageSync('userRegistered', true)
    if (!openid && registered) wx.setStorageSync('userRegistered', false)
    this.ensureAutoLogin()
  }
})
