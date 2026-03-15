// 应用入口
// - 初始化云开发环境
// - 仅初始化云环境，不在启动时自动获取 openid
App({
  globalData: {
    openid: ''
  },
  onLaunch(){
    wx.cloud.init({
      env:"cloud1-9ghbta8g727e619f"
    })
    wx.setStorageSync('userRegistered', false)
    wx.removeStorageSync('afterLoginTab')
    wx.removeStorageSync('openid')
    this.globalData.openid = ''
  }
})
