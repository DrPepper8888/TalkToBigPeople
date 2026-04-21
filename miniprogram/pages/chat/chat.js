const app = getApp()

let messageId = 0

Page({
  data: {
    personId: '',
    personName: '',
    messages: [],
    inputValue: '',
    scrollTop: 0,
    loading: false
  },

  onShow() {
    // 从 globalData 获取 apiBaseUrl，方便统一修改
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
  },

  onInput(e) {
    this.setData({
      inputValue: e.detail.value
    })
  },

  async sendMessage() {
    const content = this.data.inputValue.trim()
    if (!content || this.data.loading) return

    // 添加用户消息
    const userMessage = {
      id: ++messageId,
      role: 'user',
      content
    }

    this.setData({
      messages: [...this.data.messages, userMessage],
      inputValue: '',
      loading: true,
    })
    this.scrollToBottom()

    try {
      const that = this
      const url = `${this.data.apiBaseUrl}/api/chat`

      const response = await wx.request({
        url,
        method: 'POST',
        data: {
          personId: this.data.personId,
          messages: this.data.messages.map(m => ({ role: m.role, content: m.content }))
        },
        enableChunked: true
      })

      let fullText = ''
      let assistantMessageId = ++messageId

      response.onChunkReceived(function(res) {
        const text = that.decodeChunk(res.data)
        fullText += text
        // 更新消息
        const messages = that.data.messages
        const lastMessage = messages[messages.length - 1]
        if (lastMessage.role === 'assistant' && lastMessage.id === assistantMessageId) {
          lastMessage.content = fullText
        } else {
          messages.push({
            id: assistantMessageId,
            role: 'assistant',
            content: fullText
          })
        }
        that.setData({
          messages
        })
        that.scrollToBottom()
      })

      response.onClose(function() {
        that.setData({
          loading: false
        })
      })

    } catch (err) {
      console.error(err)
      wx.showToast({
        title: '发送失败，请重试',
        icon: 'none'
      })
      this.setData({
        loading: false
      })
    }
  },

  scrollToBottom() {
    wx.createSelectorQuery().select('.chat-container').boundingClientRect(function(rect){
      const scrollTop = rect.bottom
      this.setData({
        scrollTop
      })
    }).exec()
  },

  decodeChunk(data) {
    // 处理sse chunk
    const str = String.fromCharCode.apply(null, new Uint8Array(data))
    const lines = str.split('\n')
    let text = ''
    lines.forEach(line => {
      if (line.startsWith('data: ')) {
        const json = line.replace('data: ', '')
        try {
          const data = JSON.parse(json)
          text += data.text || ''
        } catch(e) {
          // ignore
        }
      }
    })
    return text
  }
})
