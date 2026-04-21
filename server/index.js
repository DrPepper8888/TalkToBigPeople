const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// 配置
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'http://localhost:3000/v1';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.use(cors());
app.use(express.json());

// 数据文件路径
const DATA_FILE = path.join(__dirname, 'data', 'great-people.json');

// 读取所有名人数据（内置 + 用户自定义）
function loadAllPeople() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('读取名人数据失败:', err);
  }
  return [];
}

// 保存名人数据
function saveAllPeople(people) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(people, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('保存名人数据失败:', err);
    return false;
  }
}

// 根据名人数据自动生成系统提示词
function generateSystemPrompt(person) {
  let prompt = `你现在要扮演${person.name}。请严格按照以下要求说话：\n\n`;
  
  prompt += `## 人物基本信息\n${person.biography || person.description}\n\n`;
  
  if (person.famousQuotes && person.famousQuotes.length > 0) {
    prompt += `## 你的名人名言\n${person.famousQuotes.join('\n')}\n\n`;
    prompt += `- 聊天时可以自然穿插这些名言，当作你的口头禅，不要太生硬\n`;
  }
  
  if (person.works && person.works.length > 0) {
    prompt += `\n## 你的核心作品\n当聊到你的作品时，你可以引用原文，然后在小括号里加上注释和现代翻译，方便用户理解\n`;
  }
  
  prompt += `\n## 说话要求\n`;
  prompt += `- 说话风格、思想观点必须符合这个人物的身份和性格\n`;
  prompt += `- 如果聊到你的作品，引用原文后，请用小括号补充注释和现代文翻译\n`;
  prompt += `- 请用符合这个人物身份的语言回答问题，不要出戏\n`;
  
  return prompt;
}

// 初始加载数据
let greatPeople = loadAllPeople();

// 获取伟人列表（返回所有精简信息用于列表展示）
app.get('/api/people', (req, res) => {
  const list = greatPeople.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    isBuiltin: p.isBuiltin
  }));
  res.json({
    code: 0,
    data: list
  });
});

// 创建自定义名人
app.post('/api/people/create', (req, res) => {
  try {
    const { name, description, famousQuotes, works, biography } = req.body;
    
    // 生成唯一id
    const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const exists = greatPeople.find(p => p.id === id);
    if (exists) {
      return res.json({
        code: 1,
        message: '该名称已存在，请换一个名称'
      });
    }
    
    const newPerson = {
      id,
      name,
      description,
      isBuiltin: false,
      famousQuotes: famousQuotes || [],
      works: works || [],
      biography: biography || ''
    };
    
    greatPeople.push(newPerson);
    if (saveAllPeople(greatPeople)) {
      res.json({
        code: 0,
        data: {
          id: newPerson.id,
          name: newPerson.name,
          description: newPerson.description,
          isBuiltin: newPerson.isBuiltin
        },
        message: '创建成功'
      });
    } else {
      res.json({
        code: 1,
        message: '保存失败，请稍后重试'
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 1, message: err.message });
  }
});

// 删除自定义名人
app.post('/api/people/delete', (req, res) => {
  try {
    const { id } = req.body;
    const index = greatPeople.findIndex(p => p.id === id);
    if (index === -1) {
      return res.json({ code: 1, message: '未找到该名人' });
    }
    if (greatPeople[index].isBuiltin) {
      return res.json({ code: 1, message: '内置名人不能删除' });
    }
    greatPeople.splice(index, 1);
    if (saveAllPeople(greatPeople)) {
      res.json({ code: 0, message: '删除成功' });
    } else {
      res.json({ code: 1, message: '删除失败，请稍后重试' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 1, message: err.message });
  }
});

// 聊天接口
app.post('/api/chat', async (req, res) => {
  try {
    const { personId, messages } = req.body;
    const person = greatPeople.find(p => p.id === personId);
    if (!person) {
      return res.status(404).json({ code: 1, message: '未找到该伟人' });
    }

    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
      baseURL: OPENAI_BASE_URL,
    });

    // 自动生成系统提示词
    const systemPrompt = generateSystemPrompt(person);

    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    const completion = await openai.chat.completions.create({
      model: process.env.MODEL || 'gpt-3.5-turbo',
      messages: fullMessages,
      stream: true,
    });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    for await (const chunk of completion) {
      const text = chunk.choices[0]?.delta?.content || '';
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }

    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 1, message: err.message });
  }
});

app.listen(port, () => {
  console.log(`Talk with Great People backend running at http://localhost:${port}`);
  console.log(`已加载 ${greatPeople.length} 位名人:`);
  greatPeople.forEach(p => {
    console.log(`  - ${p.name} ${p.isBuiltin ? '(内置)' : '(自定义)'}`);
  });
});
