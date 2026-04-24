const app = getApp()

Page({
  data: {
    builtinPeople: [],
    customPeople: [],
    loading: true,
    loadError: '',
    showImportDialog: false,
    importJsonText: '',
    importing: false
  },

  onLoad() {
    this.loadPeople()
  },

  onShow() {
    // 每次回来刷新列表，可能有新增自定义人物
    this.loadPeople()
  },

  loadPeople() {
    this.setData({
      loading: true,
      loadError: ''
    })

    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/people`,
      timeout: 10000,
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
        } else {
          this.setData({
            loading: false,
            loadError: res.data.message || '加载失败'
          })
        }
      },
      fail: (err) => {
        console.error('加载失败:', err)
        this.setData({
          loading: false,
          loadError: '无法连接到后端服务，请检查：\n1. 后端是否已启动\n2. apiBaseUrl 配置是否正确\n3. 网络是否正常'
        })
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
      content: `确定要删除自定义人物「${name}」吗？此操作不可恢复。`,
      confirmText: '删除',
      confirmColor: '#fa5151',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' })
          wx.request({
            url: `${app.globalData.apiBaseUrl}/api/people/delete`,
            method: 'POST',
            data: { id },
            timeout: 10000,
            success: (res) => {
              wx.hideLoading()
              if (res.data.code === 0) {
                wx.showToast({ title: '删除成功', icon: 'success' })
                this.loadPeople()
              } else {
                wx.showToast({ title: res.data.message || '删除失败', icon: 'none' })
              }
            },
            fail: () => {
              wx.hideLoading()
              wx.showToast({ title: '网络错误，删除失败', icon: 'none' })
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
  },

  // ========== 数据导出功能 ==========
  exportData() {
    const customPeople = this.data.customPeople
    if (customPeople.length === 0) {
      wx.showToast({ title: '暂无可导出的数据', icon: 'none' })
      return
    }

    // 准备导出数据（只导出自定义人物）
    const exportData = customPeople.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      biography: p.biography || '',
      famousQuotes: p.famousQuotes || [],
      works: p.works || []
    }))

    const jsonStr = JSON.stringify(exportData, null, 2)

    // 复制到剪贴板
    wx.setClipboardData({
      data: jsonStr,
      success: () => {
        wx.showModal({
          title: '✅ 导出成功',
          content: `已成功导出 ${customPeople.length} 位名人数据，数据已复制到剪贴板。\n\n你可以：\n1. 粘贴到文件保存备份\n2. 分享给朋友直接导入`,
          showCancel: false,
          confirmText: '知道了'
        })
      },
      fail: () => {
        wx.showToast({ title: '复制失败，请重试', icon: 'none' })
      }
    })
  },

  // ========== 数据导入功能 ==========
  showImportDialog() {
    this.setData({
      showImportDialog: true,
      importJsonText: ''
    })
  },

  hideImportDialog() {
    this.setData({
      showImportDialog: false
    })
  },

  stopPropagation() {
    // 阻止事件冒泡
  },

  onImportInput(e) {
    this.setData({
      importJsonText: e.detail.value
    })
  },

  async doImport() {
    const text = this.data.importJsonText.trim()
    if (!text) {
      wx.showToast({ title: '请输入要导入的数据', icon: 'none' })
      return
    }

    // 解析 JSON
    let importData
    try {
      importData = JSON.parse(text)
    } catch (e) {
      wx.showToast({ title: 'JSON 格式错误，请检查', icon: 'none' })
      return
    }

    // 数据校验
    if (!Array.isArray(importData)) {
      wx.showToast({ title: '数据格式错误，应为数组格式', icon: 'none' })
      return
    }

    // 校验每个元素
    const invalidItems = importData.filter(item => !item.name || !item.description)
    if (invalidItems.length > 0) {
      wx.showToast({ title: `第 ${invalidItems[0]} 项缺少 name 或 description`, icon: 'none' })
      return
    }

    // 确认导入
    wx.showModal({
      title: '确认导入',
      content: `即将导入 ${importData.length} 位名人数据，是否继续？`,
      success: async (res) => {
        if (res.confirm) {
          this.setData({ importing: true })

          let successCount = 0
          let failCount = 0

          // 逐个导入（为了显示进度，也可以批量导入）
          for (let i = 0; i < importData.length; i++) {
            const person = importData[i]
            try {
              const result = await this.importOnePerson(person)
              if (result.success) {
                successCount++
              } else {
                failCount++
                console.warn(`导入「${person.name}」失败:`, result.message)
              }
            } catch (e) {
              failCount++
              console.error(`导入「${person.name}」异常:`, e)
            }
          }

          this.setData({
            importing: false,
            showImportDialog: false
          })

          // 刷新列表
          this.loadPeople()

          // 显示结果
          wx.showModal({
            title: '导入完成',
            content: `成功导入 ${successCount} 位${failCount > 0 ? `，失败 ${failCount} 位（名称重复或数据错误）` : ''}`,
            showCancel: false
          })
        }
      }
    })
  },

  // 批量导入人物（使用后端批量 API，效率更高）
  importOnePerson(person) {
    // 单个导入使用批量 API 保持一致性
    return new Promise((resolve) => {
      wx.request({
        url: `${app.globalData.apiBaseUrl}/api/people/import`,
        method: 'POST',
        data: { people: [person] },
        success: (res) => {
          if (res.data.code === 0 && res.data.data.results[0].success) {
            resolve({ success: true })
          } else {
            resolve({ success: false, message: res.data.data?.results[0]?.message || res.data.message })
          }
        },
        fail: () => {
          resolve({ success: false, message: '网络错误' })
        }
      })
    })
  }
})
