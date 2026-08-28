export const editorSeeds = [
  ["ED-0001","Nilay Patel","The Verge","Editor-in-Chief","人工智能；大型科技公司；科技政策；媒体商业","https://x.com/reckless","观察中","重点","2026-08-20"],
  ["ED-0002","Alex Heath","The Verge","Sources author；Access 播客联合主持人","人工智能；硅谷；社交媒体；大型科技公司","https://x.com/alexeheath","观察中","重点","2026-01-23"],
  ["ED-0003","Lauren Goode","WIRED","Senior Correspondent","人工智能；半导体；创投；初创公司；职场文化；硅谷人物",null,"观察中","重点","2026-08-21"],
  ["ED-0004","Will Knight","WIRED","Senior Writer","人工智能；机器学习；机器人；中国AI","https://x.com/willknight","观察中","重点","2026-08-19"],
  ["ED-0005","Connie Loizos","TechCrunch","Editor in Chief & General Manager","硅谷；人工智能；创投；初创公司；科技商业","https://x.com/Cookie","观察中","重点","2026-07-29"],
  ["ED-0006","Kirsten Korosec","TechCrunch","Transportation Editor","电动汽车；自动驾驶；城市空中交通；车载技术","https://x.com/kirstenkorosec","观察中","重点","2026-08-20"],
  ["ED-0007","Sarah Perez","TechCrunch","Consumer News Editor","消费互联网；应用；平台政策；社交媒体；RSS","https://x.com/SarahPerezTC","观察中","重点","2026-08-17"],
  ["ED-0008","Zack Whittaker","TechCrunch","Security Editor","网络安全；隐私；监控技术；数据泄露；国家安全","https://x.com/zackwhittaker","观察中","重点","2026-08-13"],
  ["ED-0009","Mark Spoonauer","Tom's Guide","Global Editor-in-Chief","消费电子；智能手机；Apple；Android；移动设备","https://x.com/mspoonauer","观察中","X优先","2026-08-20"],
  ["ED-0010","Lance Ulanoff","TechRadar","Editor At Large","消费电子；智能手机；可折叠设备；Apple；人工智能","https://x.com/LanceUlanoff","观察中","X优先","2026-08-20"],
  ["ED-0011","Cherlynn Low","Engadget","Executive Editor","消费电子；智能手机；笔记本电脑；可穿戴；健康科技","https://x.com/cherlynnlow","观察中","X优先","2026-08-21"],
  ["ED-0012","Dan Grabham","Stuff","Editor-in-Chief","消费电子；电脑；智能手机；音频；智能家居","https://x.com/dangrabham","观察中","X优先","2026-08-08"],
  ["ED-0013","C. Scott Brown","Android Authority","Video Lead & Managing Editor","Android；智能手机；移动设备；产品设计；消费科技",null,"观察中","重点","2026-07-10"],
  ["ED-0014","Eric Slivka","MacRumors","Editor-in-Chief","Apple；iPhone；Mac；配件；显示器","https://x.com/eslivka","观察中","X优先","2026-08-10"],
  ["ED-0015","Jason Cross","Macworld","Senior Editor","Apple；iOS；macOS；芯片；智能手机；电脑",null,"观察中","重点","2026-08-24"],
  ["ED-0016","Jaron Schneider","PetaPixel","Editor-in-Chief","相机；摄影；视频；影像技术；创作者设备","https://x.com/jaronschneider","观察中","X优先","2026-08-12"],
  ["ED-0017","Mat Gallagher","T3","Editor-in-Chief, T3.com","生活方式科技；智能手机；电视；电动汽车；影像",null,"观察中","常规","2026-08-12"],
  ["ED-0018","Kerry Wan","ZDNET","Editor-in-Chief","消费电子；智能手机；笔记本电脑；产品测试；购买决策",null,"观察中","重点","2026-08-19"],
] as const;

export const articleSeeds = [
  ["AR-000011","ED-0011","Pixel Watch 5 review: A fantastic watch that's missing features at launch","https://www.engadget.com/2241496/google-pixel-watch-5-review/","2026-08-21","关注端侧 Gemini、快充和操控，同时指出部分健康与训练功能发布时尚未上线。","可穿戴；健康科技；Google","Engadget"],
  ["AR-000010","ED-0010","The Google Pixel 11 Pro Fold is the best folding Pixel yet — but it doesn't beat Samsung's best","https://www.techradar.com/phones/google-pixel-phones/google-pixel-11-pro-fold-review","2026-08-20","评测屏幕、耐用性与体验改进，并指出其仍未超越三星旗舰折叠屏。","折叠屏；Android；Google","TechRadar"],
  ["AR-000009","ED-0009","3 big reasons I'd buy iPhone 18 Pro Max over iPhone 18 Pro this year","https://www.tomsguide.com/phones/iphones/3-big-reasons-to-buy-iphone-18-pro-max-over-the-iphone-18-pro-this-year","2026-08-20","从屏幕、续航与影像维度分析购买选择。","智能手机；Apple；购买建议","Tom's Guide"],
  ["AR-000016","ED-0016","Insta360 Wants Its Flagship X6 to be Way More Than a 360-Degree Camera","https://petapixel.com/2026/08/12/insta360-wants-its-flagship-x6-to-be-way-more-than-a-360-degree-camera/","2026-08-12","讨论 Insta360 X6 从360相机扩展为通用创作者设备的定位。","相机；360影像；创作者设备","PetaPixel"],
  ["AR-000014","ED-0014","Apple Still Planning 'Glass-Centric' iPhone Redesign for 2027","https://www.macrumors.com/2026/08/10/glass-centric-iphone-still-planned-2027/","2026-08-10","跟进2027年纪念版 iPhone 的玻璃化设计传闻。","Apple；iPhone；工业设计","MacRumors"],
] as const;

export const opportunitySeeds = [
  ["XOP-001","ED-0011","AR-000011","紧急","如有真实健康或训练场景，可围绕发布时缺失功能提出一个具体问题。","2026-08-27","未检查","待找原帖"],
  ["XOP-002","ED-0010","AR-000010","高","围绕耐用性、生产力或屏幕比例提出具体问题，避免泛泛称赞。","2026-08-28","未检查","待找原帖"],
  ["XOP-003","ED-0009","AR-000009","高","如有真实购买偏好或用户数据，补充影响选择的一个因素。","2026-08-29","未检查","待找原帖"],
  ["XOP-004","ED-0016","AR-000016","中","围绕创作者工作流或360影像的真实限制补充一个场景。","2026-08-30","未检查","待找原帖"],
  ["XOP-005","ED-0014","AR-000014","中","传闻内容只讨论信息可信度或设计影响，不扩散未经确认的结论。","2026-08-31","未检查","待找原帖"],
] as const;
