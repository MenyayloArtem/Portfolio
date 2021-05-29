const App = {
    data(){
        return {
            auth : false,
            permission : 'guest',
            posts : [],
            info : {
                adress : 'Ukraine,Donetckaya oblast,Torez',
                telephone : '+380710000000 \n +88005553535',
                email : 'menyaylo-artem@mail.ru qasdftg79@gmail.com'
            }
        }
    
    },
    computed : {
        postsSeen(){
            return Boolean(this.posts.length)
        }
    },
    async mounted(){
        try {
            let posts = await fetch('/posts')
            let res = await posts.json()
            this.posts.push(...res)
        } catch(err){
            console.log(err)
        }
    
        let getPermission = await fetch('/permission')
        let {permission,id} = await getPermission.json()
        console.log(permission,id)
        this.permission = permission
        this.id = id
    }
}

Vue.createApp(App).mount('#app')