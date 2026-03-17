function buildErrorMessage(err) {
  return '操作失败，请稍后重试'
}

Page({
  data: {
    feedbackText: '',
    helpItems: [
      '首页：记录每日体重、查看目标进度与历史变化',
      '折线图：查看体重趋势，记录饮食、饮水和作息',
      '排行榜：排行榜入口（当前为预留）',
      '个人中心：编辑个人资料，查看称重状态，进入提醒与更多设置',
      '称重提醒：检查当天是否已记录体重，未记录会提醒去打卡',
      '饮水提醒：支持目标设置、快捷记录、手动记录和趋势统计',
      '作息提醒：支持作息时间设置与作息记录'
    ]
  },
  onBack() {
    const pages = getCurrentPages()
    if (pages && pages.length > 1) {
      wx.navigateBack({ delta: 1 })
      return
    }
    wx.switchTab({ url: '/pages/profile/index' })
  },
  onFeedbackInput(e) {
    const text = ((e && e.detail && e.detail.value) || '').slice(0, 300)
    this.setData({ feedbackText: text })
  },
  async onSubmitFeedback() {
    const openid = wx.getStorageSync('openid') || ''
    if (!openid) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    const content = (this.data.feedbackText || '').trim()
    if (!content) {
      wx.showToast({ title: '请输入反馈内容', icon: 'none' })
      return
    }
    const db = wx.cloud.database()
    wx.showLoading({ title: '提交中' })
    try {
      await db.collection('feedback_record').add({
        data: {
          content,
          status: 'new',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      })
      this.setData({ feedbackText: '' })
      wx.hideLoading()
      wx.showToast({ title: '提交成功', icon: 'success' })
    } catch (e) {
      wx.hideLoading()
      wx.showModal({
        title: '提交失败',
        content: buildErrorMessage(e),
        showCancel: false
      })
    }
  },
  async clearCollectionByOpenid(db, collectionName, openid) {
    const limit = 20
    while (true) {
      const res = await db.collection(collectionName).where({ _openid: openid }).limit(limit).get()
      const list = (res && res.data) ? res.data : []
      if (!list.length) break
      await Promise.all(list.map((item) => db.collection(collectionName).doc(item._id).remove().catch(() => null)))
      if (list.length < limit) break
    }
  },
  async onClearData() {
    const openid = wx.getStorageSync('openid') || ''
    if (!openid) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    const confirm = await new Promise((resolve) => {
      wx.showModal({
        title: '确认清除',
        content: '将清除体重、目标、饮食、饮水、作息、反馈等数据，是否继续？',
        confirmColor: '#ff4d4f',
        success: (res) => resolve(!!(res && res.confirm)),
        fail: () => resolve(false)
      })
    })
    if (!confirm) return
    const db = wx.cloud.database()
    const _ = db.command
    wx.showLoading({ title: '清除中' })
    try {
      await this.clearCollectionByOpenid(db, 'weight_records', openid)
      await this.clearCollectionByOpenid(db, 'diet_record', openid)
      await this.clearCollectionByOpenid(db, 'sleep_record', openid)
      await this.clearCollectionByOpenid(db, 'feedback_record', openid)
      await db.collection('target_weight').doc(openid).remove().catch(() => null)
      await db.collection('water_setting').doc(openid).remove().catch(() => null)
      await db.collection('sleep_setting').doc(openid).remove().catch(() => null)
      await db.collection('user').doc(openid).update({
        data: {
          avatarFileID: _.remove(),
          gender: _.remove(),
          birthDate: _.remove(),
          heightCm: _.remove(),
          waterSetting: _.remove(),
          sleepSetting: _.remove(),
          updatedAt: Date.now()
        }
      }).catch(() => null)
      wx.removeStorageSync('bmi_height_cm')
      wx.removeStorageSync('bmi_weight_kg')
      wx.removeStorageSync('afterLoginTab')
      wx.removeStorageSync('chartAction')
      wx.hideLoading()
      wx.showToast({ title: '已清除', icon: 'success' })
    } catch (e) {
      wx.hideLoading()
      wx.showModal({
        title: '清除失败',
        content: buildErrorMessage(e),
        showCancel: false
      })
    }
  }
})
