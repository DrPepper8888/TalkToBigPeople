const app = getApp()

Page({
  data: {
    builtinPeople: [],
    customPeople: [],
    loading: true
  },

  onLoad() {
    this.loadPeople()
  },

  onShow() {
    // 每次回来刷新列表，可能有新增自定义人物
    this.loadPeople()
  },

  loadPeople() {
    this.setData({ loading: true })
    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/people`,
      success: (res) => {
        if (res.data.code === 0) {
          const allPeople = res.data.data
          const builtinPeople = allPeople.filter(p => p.isBuiltin)
          const customPeople = allPeople.filter(p => !p.isBuiltin)
          this.setData({
            builtinPeople,
            customPeople,
            loading: false
          })
        }
      },
      fail: () => {
        wx.showToast({ title: '加载失败，请检查后端地址', icon: 'none' })
        this.setData({ loading: false })
      }
    })
  },

  goToCreate() {
    wx.navigateTo({
      url: '/pages/create/create'
    })
  },

  deletePerson(e) {
    const { id } = e.currentTarget.dataset
    const { name } = e.currentTarget.dataset
    wx.showModal({
      title: '确认删除',
      content: `确定要删除自定义人物 "${name}" 吗？`,
      success: (res) => {
        if (res.confirm) {
          wx.request({
            url: `${app.globalData.apiBaseUrl}/api/people/delete`,
            method: 'POST',
            data: { id },
            success: (res) => {
              if (res.data.code === 0) {
                wx.showToast({ title: '删除成功', icon: 'success' })
                this.loadPeople()
              } else {
                wx.showToast({ title: res.data.message || '删除失败', icon: 'none' })
              }
            }
          })
        }
      }
    })
  },

  selectPerson(e) {
    const { id } = e.currentTarget.dataset
    const { name } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/chat/chat?personId=${id}&personName=${name}`
    })
  }
})
