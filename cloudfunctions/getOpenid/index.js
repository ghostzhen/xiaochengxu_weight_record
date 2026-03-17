// 云函数：获取 openid
// 说明：无需依赖 wx-server-sdk，直接从 context 读取 OPENID
exports.main = (event, context) => {
  const openidFromContext = context && (context.OPENID || context.WX_OPENID)
  const openidFromEvent = event && event.userInfo && event.userInfo.openId
  const openid = openidFromContext || openidFromEvent || ''
  return { openid }
}
