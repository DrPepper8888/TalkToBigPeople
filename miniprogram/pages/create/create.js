const app = getApp()

Page({
  data: {
    name: '',
    description: '',
    biography: '',
    famousQuotesText: '',
    works: [],
    submitting: false
  },

  onLoad() {
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value })
  },

  onDescInput(e) {
    this.setData({ description: e.detail.value })
  },

  onBioInput(e) {
    this.setData({ biography: e.detail.value })
  },

  onQuotesInput(e) {
    this.setData({ famousQuotesText: e.detail.value })
  },

  addWork() {
    const works = this.data.works
    works.push({
      title: '',
      originalText: '',
      modernTranslation: '',
      explanation: ''
    })
    this.setData({ works })
  },

  deleteWork(e) {
    const { index } = e.currentTarget.dataset
    const works = this.data.works
    works.splice(index, 1)
    this.setData({ works })
  },

  onWorkTitleInput(e) {
    const { index } = e.currentTarget.dataset
    const works = this.data.works
    works[index].title = e.detail.value
    this.setData({ works })
  },

  onWorkOriginalInput(e) {
    const { index } = e.currentTarget.dataset
    const works = this.data.works
    works[index].originalText = e.detail.value
    this.setData({ works })
  },

  onWorkTranslationInput(e) {
    const { index } = e.currentTarget.dataset
    const works = this.data.works
    works[index].modernTranslation = e.detail.value
    this.setData({ works })
  },

  onWorkExplanationInput(e) {
    const { index } = e.currentTarget.dataset
    const works = this.data.works
    works[index].explanation = e.detail.value
    this.setData({ works })
  },

  submit() {
    const { name, description, biography, famousQuotesText, works } = this.data

    // 校验必填项
    if (!name.trim()) {
      wx.showToast({ title: '请输入人物名称', icon: 'none' })
      return
    }
    if (!description.trim()) {
      wx.showToast({ title: '请输入简短描述', icon: 'none' })
      return
    }

    this.setData({ submitting: true })

    // 处理名人名言（按行分割）
    const famousQuotes = famousQuotesText.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)

    // 过滤空作品
    const validWorks = works.filter(work => work.title.trim() || work.originalText.trim())

    wx.request({
      url: `${getApp().globalData.apiBaseUrl}/api/people/create`,
      method: 'POST',
      data: {
        name: name.trim(),
        description: description.trim(),
        biography: biography.trim(),
        famousQuotes,
        works: validWorks
      },
      success: (res) => {
        if (res.data.code === 0) {
          wx.showToast({ title: '创建成功', icon: 'success' })
          setTimeout(() => {
            wx.navigateBack()
          }, 1500)
        } else {
          wx.showToast({ title: res.data.message || '创建失败', icon: 'none' })
        }
      },
      fail: () => {
        wx.showToast({ title: '网络错误，请检查后端地址', icon: 'none' })
      },
      complete: () => {
        this.setData({ submitting: false })
      }
    })
  }
})
