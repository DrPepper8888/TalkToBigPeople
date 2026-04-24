const app = getApp()

// 草稿存储 key
const DRAFT_KEY = 'create_person_draft'

Page({
  data: {
    name: '',
    description: '',
    biography: '',
    famousQuotesText: '',
    works: [],
    submitting: false,
    hasDraft: false
  },

  onLoad() {
    // 加载草稿
    this.loadDraft()
  },

  onUnload() {
    // 离开页面时自动保存草稿（如果有内容）
    this.saveDraft()
  },

  // ========== 草稿自动保存 ==========
  loadDraft() {
    try {
      const draft = wx.getStorageSync(DRAFT_KEY)
      if (draft) {
        this.setData({
          ...draft,
          hasDraft: true
        })
      }
    } catch (e) {
      console.error('加载草稿失败:', e)
    }
  },

  saveDraft() {
    try {
      const { name, description, biography, famousQuotesText, works } = this.data
      const hasContent = name || description || biography || famousQuotesText || (works && works.length > 0)

      if (hasContent) {
        wx.setStorageSync(DRAFT_KEY, {
          name,
          description,
          biography,
          famousQuotesText,
          works
        })
      }
    } catch (e) {
      console.error('保存草稿失败:', e)
    }
  },

  clearDraft() {
    try {
      wx.removeStorageSync(DRAFT_KEY)
      this.setData({ hasDraft: false })
    } catch (e) {
      console.error('清除草稿失败:', e)
    }
  },

  // ========== 表单输入处理 ==========
  onNameInput(e) {
    this.setData({ name: e.detail.value })
    this.saveDraft()
  },

  onDescInput(e) {
    this.setData({ description: e.detail.value })
    this.saveDraft()
  },

  onBioInput(e) {
    this.setData({ biography: e.detail.value })
    this.saveDraft()
  },

  onQuotesInput(e) {
    this.setData({ famousQuotesText: e.detail.value })
    this.saveDraft()
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
    this.saveDraft()
  },

  deleteWork(e) {
    const { index } = e.currentTarget.dataset
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个作品吗？',
      success: (res) => {
        if (res.confirm) {
          const works = this.data.works
          works.splice(index, 1)
          this.setData({ works })
          this.saveDraft()
        }
      }
    })
  },

  onWorkTitleInput(e) {
    const { index } = e.currentTarget.dataset
    const works = this.data.works
    works[index].title = e.detail.value
    this.setData({ works })
    this.saveDraft()
  },

  onWorkOriginalInput(e) {
    const { index } = e.currentTarget.dataset
    const works = this.data.works
    works[index].originalText = e.detail.value
    this.setData({ works })
    this.saveDraft()
  },

  onWorkTranslationInput(e) {
    const { index } = e.currentTarget.dataset
    const works = this.data.works
    works[index].modernTranslation = e.detail.value
    this.setData({ works })
    this.saveDraft()
  },

  onWorkExplanationInput(e) {
    const { index } = e.currentTarget.dataset
    const works = this.data.works
    works[index].explanation = e.detail.value
    this.setData({ works })
    this.saveDraft()
  },

  // ========== 表单提交 ==========
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
    const validWorks = works.filter(work =>
      work.title.trim() || work.originalText.trim()
    )

    wx.showLoading({ title: '创建中...' })

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
      timeout: 15000,
      success: (res) => {
        wx.hideLoading()
        if (res.data.code === 0) {
          wx.showToast({ title: '创建成功', icon: 'success' })
          // 清除草稿
          this.clearDraft()
          // 延迟返回
          setTimeout(() => {
            wx.navigateBack()
          }, 1500)
        } else {
          wx.showModal({
            title: '创建失败',
            content: res.data.message || '请稍后重试',
            showCancel: false
          })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        console.error('创建失败:', err)
        wx.showModal({
          title: '网络错误',
          content: '无法连接到服务器，请检查：\n1. 后端服务是否已启动\n2. 网络连接是否正常',
          showCancel: false
        })
      },
      complete: () => {
        this.setData({ submitting: false })
      }
    })
  },

  // ========== 清除草稿 ==========
  clearDraftConfirm() {
    wx.showModal({
      title: '清除草稿',
      content: '确定要清除当前的编辑内容吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            name: '',
            description: '',
            biography: '',
            famousQuotesText: '',
            works: []
          })
          this.clearDraft()
          wx.showToast({ title: '已清除', icon: 'success' })
        }
      }
    })
  }
})
