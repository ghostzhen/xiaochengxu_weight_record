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

Page({
  data: {
    heightCm: '',
    weightKg: '',
    weightFromDate: '',
    bmiText: '--',
    levelText: '--',
    levelClass: 'badge-empty'
  },
  onBack: function () {
    var pages = getCurrentPages()
    if (pages && pages.length > 1) {
      wx.navigateBack({ delta: 1 })
      return
    }
    wx.switchTab({ url: '/pages/index/index' })
  },
  onLoad: function (options) {
    var cachedHeight = wx.getStorageSync('bmi_height_cm') || ''
    var cachedWeight = wx.getStorageSync('bmi_weight_kg') || ''
    var w = options && options.weight ? ('' + options.weight) : ''
    var date = options && options.date ? ('' + options.date) : ''
    this.setData({
      heightCm: cachedHeight ? ('' + cachedHeight) : '',
      weightKg: w && w !== '0' ? w : (cachedWeight ? ('' + cachedWeight) : ''),
      weightFromDate: date
    })
    this.recalc()
  },
  onHeightInput: function (e) {
    var raw = (e && e.detail && e.detail.value) ? e.detail.value : ''
    var v = cleanDecimalInput(raw, 1)
    this.setData({ heightCm: v })
    wx.setStorageSync('bmi_height_cm', v)
    this.recalc()
  },
  onWeightInput: function (e) {
    var raw = (e && e.detail && e.detail.value) ? e.detail.value : ''
    var v = cleanDecimalInput(raw, 1)
    this.setData({ weightKg: v })
    wx.setStorageSync('bmi_weight_kg', v)
    this.recalc()
  },
  onHeightBlur: function () {
    var h = parseFloat(this.data.heightCm)
    if (!h) return
    if (h < 80 || h > 250) wx.showToast({ title: '身高建议填写 80~250cm', icon: 'none' })
  },
  onWeightBlur: function () {
    var w = parseFloat(this.data.weightKg)
    if (!w) return
    if (w < 20 || w > 300) wx.showToast({ title: '体重建议填写 20~300kg', icon: 'none' })
  },
  recalc: function () {
    var h = parseFloat(this.data.heightCm)
    var w = parseFloat(this.data.weightKg)
    if (!h || !w || h <= 0 || w <= 0) {
      this.setData({
        bmiText: '--',
        levelText: '--',
        levelClass: 'badge-empty'
      })
      return
    }
    var hm = h / 100
    var bmi = w / (hm * hm)
    var bmiText = (Math.round(bmi * 10) / 10).toFixed(1)
    var levelText = ''
    var levelClass = ''
    if (bmi < 18.5) {
      levelText = '偏瘦'
      levelClass = 'badge-thin'
    } else if (bmi < 24) {
      levelText = '正常'
      levelClass = 'badge-normal'
    } else if (bmi < 28) {
      levelText = '偏胖'
      levelClass = 'badge-over'
    } else {
      levelText = '肥胖'
      levelClass = 'badge-obese'
    }
    this.setData({
      bmiText: bmiText,
      levelText: levelText,
      levelClass: levelClass
    })
  }
})
