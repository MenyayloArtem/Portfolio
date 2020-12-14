const express = require('express')
const mysql = require("mysql2");
const fs = require('fs')
const path = require('path')
const multer = require('multer')
const app = express()
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const secret = 'secret'

let session = require('express-session');
const { decode } = require('punycode');

app.use(session({
    secret,
    cookie: {
        httpOnly : true,
        maxAge: 60000
    }
}))

const data = {
    host: "localhost",
    user: "testNode",
    database: "portfolio",
    password: "12345"
}
app.use(multer({dest:"uploads"}).single("filedata"));
app.use(bodyParser.json())
app.use(cookieParser())

app.listen(3000)
  
const pool = mysql.createPool(data).promise();
 
app.get('/',(req,res)=>{
    res.sendFile(path.join(__dirname,'index.html'))
})

app.get('/posts',async (req,res)=>{
    pool.execute('SELECT * FROM posts').then(([rows,fields])=>{
        res.send(rows)
    }).catch(err => {
        throw err
    })
})

app.get('/permission',(req,res)=>{
    if(req.cookies['token']){
        let token = req.cookies['token'].split(' ')[1]
        jwt.verify(token,secret,(err,{permission,id})=>{
        res.json({permission,id})
    })
    } else {
        res.json({
            permission : 'guest',
            id : null
        })
    }
})

app.get('/post:id',(req,res)=>{
    res.sendFile(path.join(__dirname,'/post.html'))
})

app.get('/getPost:id',async (req,res)=>{
    let id = req.params.id.split(':')[1]
    pool.execute(`SELECT * FROM posts WHERE id = ${id}`)
    .then(([rows,fields]) => {
        res.send(rows[0])
    }).catch(err => {
        throw err
    })
})

app.get('/editPost:id',async (req,res)=>{
    let token = req.cookies['token'].split(' ')[1]
    let id = req.params.id.split(':')[1]
    let [authorID] = await pool.execute(`SELECT authorID FROM posts WHERE id = ${id}`)
    authorID = authorID[0].authorID
    jwt.verify(token,secret,(err,result)=>{
    if(result.id == authorID || result.permission == 'admin'){
            res.sendFile(path.join(__dirname,'/editPost.html'))
        } else {
            res.redirect(`/post:${id}`)
        }
    })
})

app.post('/editPost:id',async (req,res,next)=>{
    let postId = +(req.params.id.split(':')[1])
    let token = req.cookies['token'].split(' ')[1]
    let decoded = await jwt.verify(token,secret)
    let id = decoded.id
    let permission = decoded.permission
    pool.execute(`SELECT authorID FROM posts
    WHERE id = ${postId}
    `).then(([rows])=>{
        let authorID = rows[0].authorID
        if(authorID == id || permission == 'admin'){
        return pool.execute('UPDATE posts SET `title` = ?,`text` = ?,`status` = ? WHERE `id` = ?',
    [req.body.title,req.body.text,req.body.status,postId]
    )
    }
    }).then(()=>{
        console.log('Пост отредактирован')
        
    }).catch(err => {
        throw err
    })
    res.redirect(`/post:${postId}`)
    next()
})

app.get('/style.css',(req,res)=>{
    res.setHeader('Content-Type', 'text/css')
    res.sendFile(path.join(__dirname,'/style.css'))
})

app.get('/script.js',(req,res)=>{
    res.setHeader('Content-Type', 'text/javascript')
    res.sendFile(path.join(__dirname,'/script.js'))
})



app.get('/newPost',
function(req,res,next){
    let token = req.cookies['token']
    let bearerToken = token.split(' ')[1]
    console.log(token)
    jwt.verify(bearerToken,secret,(err,{permission})=>{
        if(permission == 'admin'){
        console.log('Добро пожаловать')
        req.token = bearerToken
    } else {
        console.log('Вийди звiдси')
        res.redirect('/')
    }
    })
    
    next()
}
,(req,res)=>{
    res.sendFile(path.join(__dirname,'/newPost.html'))
})



app.get(/./g,(req,res)=>{
    res.sendFile(path.join(__dirname,req.url))
})

app.post('/message',(req,res,next)=>{
    fs.writeFileSync(req.body.name+'.txt',`${req.body.email}\n
    ${req.body.message}
    `)
    next()
})

app.post('/addPost',(req,res,next)=>{
    let newName = req.file.filename + '.jpg'
    fs.rename('uploads/' + req.file.filename,'uploads/' + newName,(err)=>{
        if(err) throw err
    })
    pool.execute("INSERT INTO `posts`(`title`,`status`,`text`,`imgPath`) VALUES (?,?,?,?)",
    [req.body.title,req.body.status,req.body.text,newName]).then(()=> {
        console.log('Пост добавлен')
    }).catch(err => {
        throw err.message
    })
    next()
})

app.post('/auth', async (req,res)=>{
    pool.execute(`SELECT name FROM users WHERE name = '${req.body.name}'`)
    .then(([rows,fields])=>{
        if(rows.length){
            return pool.execute(`SELECT * FROM users WHERE name = '${req.body.name}'`)
        } else {
            res.json({
                message : 'Имени не существует',
                authSusecc : false
            })
        }
    })
    .then(async ([rows])=>{
        let compare = await bcrypt.compare(req.body.password,rows[0].password)
        if(compare){
            let token = jwt.sign({
            id : rows[0].id,
            name : rows[0].name,
            permission : rows[0].permission
            },secret)
                res.cookie('token','Bearer ' + token)
                res.json({
                    message : 'Успешная авторизация',
                    authSusecc : true,
                    permission : rows[0].permission,
                    id : rows[0].id
                })
        } else {
            res.json({
                message : 'Пароли не совпадают',
                authSusecc : false
            })
        }
    })
    .catch(err => {
        throw err
    })
})
