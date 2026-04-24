const app = getApp()

let messageId = 0

Page({
  data: {
    personId: '',
    personName: '',
    messages: [],
    inputValue: '',
    scrollTop: 0,
    loading: false,
    networkError: ''
  },

  onShow() {
    this.setData({
      apiBaseUrl: getApp().globalData.apiBaseUrl
    })
  },

  onLoad(options) {
    const { personId, personName } = options
    this.setData({
      personId,
      personName,
    })
    wx.setNavigationBarTitle({
      title: `与 ${personName} 对话`
    })

    // 加载历史聊天记录
    this.loadChatHistory()

    // 注册页面卸载时保存记录
    this.saveOnExit = true
  },

  onUnload() {
    // 页面离开时保存聊天记录
    if (this.saveOnExit) {
      this.saveChatHistory()
    }
  },

  onHide() {
    this.saveChatHistory()
  },

  // ========== 聊天历史持久化 ==========
  getHistoryKey() {
    return `chat_history_${this.data.personId}`
  },

  loadChatHistory() {
    try {
      const key = this.getHistoryKey()
      const history = wx.getStorageSync(key)
      if (history && Array.isArray(history) && history.length > 0) {
        messageId = history[history.length - 1].id + 1
        this.setData({ messages: history })
        // 滚动到底部
        setTimeout(() => this.scrollToBottom(), 100)
      }
    } catch (e) {
      console.error('加载聊天历史失败:', e)
    }
  },

  saveChatHistory() {
    try {
      const key = this.getHistoryKey()
      const messages = this.data.messages
      // 只保存最近 100 条消息
      const recentMessages = messages.slice(-100)
      wx.setStorageSync(key, recentMessages)
    } catch (e) {
      console.error('保存聊天历史失败:', e)
    }
  },

  // ========== 输入处理 ==========
  onInput(e) {
    this.setData({
      inputValue: e.detail.value
    })
  },

  // ========== 发送消息 ==========
  async sendMessage() {
    const content = this.data.inputValue.trim()
    if (!content || this.data.loading) return

    // 隐藏之前的错误
    this.setData({ networkError: '' })

    // 生成时间戳
    const now = new Date()
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

    // 添加用户消息
    const userMessage = {
      id: ++messageId,
      role: 'user',
      content,
      time
    }

    const messages = [...this.data.messages, userMessage]
    this.setData({
      messages,
      inputValue: '',
      loading: true,
    })
    this.scrollToBottom()

    // 立即保存（用户消息）
    this.saveChatHistory()

    // 添加 AI 正在生成的占位消息
    const generatingId = ++messageId
    const generatingTime = new Date()
    const generatingTimeStr = `${generatingTime.getHours().toString().padStart(2, '0')}:${generatingTime.getMinutes().toString().padStart(2, '0')}`

    this.setData({
      messages: [...this.data.messages, {
        id: generatingId,
        role: 'assistant',
        content: '',
        time: generatingTimeStr,
        generating: true
      }]
    })
    this.scrollToBottom()

    try {
      const that = this
      const url = `${this.data.apiBaseUrl}/api/chat`

      // 创建 SSE 连接
      const task = wx.request({
        url,
        method: 'POST',
        data: {
          personId: this.data.personId,
          messages: this.data.messages
            .filter(m => !m.generating)
            .map(m => ({ role: m.role, content: m.content }))
        },
        enableChunked: true,
        timeout: 120000
      })

      let fullText = ''
      let hasError = false

      task.onChunkReceived(function(res) {
        const text = that.decodeChunk(res.data)
        fullText += text

        // 更新消息内容
        const messages = that.data.messages
        const lastMessage = messages[messages.length - 1]

        if (lastMessage && lastMessage.id === generatingId) {
          lastMessage.content = fullText
          lastMessage.generating = false
          that.setData({ messages })
          that.scrollToBottom()
        }
      })

      // 监听完成
      await new Promise((resolve, reject) => {
        task.onComplete(function() {
          resolve()
        })

        task.onError(function(err) {
          hasError = true
          reject(err)
        })
      })

      // 保存完成的消息
      this.saveChatHistory()

    } catch (err) {
      console.error('发送失败:', err)

      // 移除正在生成的占位消息
      const messages = this.data.messages
      if (messages.length > 0 && messages[messages.length - 1].generating) {
        messages.pop()
      }

      // 显示错误信息
      let errorMsg = '发送失败，请检查网络连接'
      if (err.errMsg && err.errMsg.includes('timeout')) {
        errorMsg = '请求超时，请重试'
      } else if (err.errMsg && err.errMsg.includes('fail')) {
        errorMsg = '无法连接到服务器，请检查后端是否正常运行'
      }

      this.setData({
        messages,
        networkError: errorMsg
      })

      wx.vibrateShort({ type: 'light' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // ========== SSE 数据解析 ==========
  decodeChunk(data) {
    try {
      // 将 ArrayBuffer 转为字符串
      const uint8 = new Uint8Array(data)
      let str = ''
      for (let i = 0; i < uint8.length; i++) {
        str += String.fromCharCode(uint8[i])
      }

      let text = ''
      const lines = str.split('\n')

      lines.forEach(line => {
        if (line.startsWith('data: ')) {
          const jsonStr = line.replace('data: ', '')
          if (jsonStr === '[DONE]') return
          try {
            const data = JSON.parse(jsonStr)
            text += data.text || ''
          } catch(e) {
            // 忽略解析错误
          }
        }
      })

      return text
    } catch (e) {
      console.error('解析 SSE 数据失败:', e)
      return ''
    }
  },

  // ========== 滚动到底部 ==========
  scrollToBottom() {
    wx.createSelectorQuery()
      .select('.chat-container')
      .scrollOffset(function(res) {
        this.setData({
          scrollTop: res.scrollHeight
        })
      }.bind(this))
      .exec()
  },

  // ========== 清空聊天记录 ==========
  showClearConfirm() {
    wx.showModal({
      title: '清空聊天记录',
      content: '确定要清空与这位智者的所有对话吗？此操作不可恢复。',
      confirmText: '清空',
      confirmColor: '#fa5151',
      success: (res) => {
        if (res.confirm) {
          this.clearChatHistory()
        }
      }
    })
  },

  clearChatHistory() {
    try {
      const key = this.getHistoryKey()
      wx.removeStorageSync(key)
      messageId = 0
      this.setData({ messages: [] })
      wx.showToast({ title: '已清空', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: '清空失败', icon: 'none' })
    }
  },

  // ========== 关闭错误提示 ==========
  dismissError() {
    this.setData({ networkError: '' })
  }
})
