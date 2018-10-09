// ==UserScript==
// @name         Newpunch Thread Auto-refresh
// @namespace    tenrys.pw
// @version      0.2
// @description  Checks for new posts in a thread on an interval and adds them to the page dynamically.
// @author       Tenrys (https://github.com/Tenrys/newpunch-thread-autorefresh)
// @include      https://forum.facepunch.com/*
// @include      http://forum.facepunch.com/*
// ==/UserScript==

let currentPostlist = document.querySelector('[class="postlist"]')

// Check if we're in a thread
if (!currentPostlist) return

let timerLength = 60

var refresher = new Vue({
    template: String.raw`<button class="button is-dark" disabled title="Thread refresher"> {{ !pageEnded ? (timer > 0 ? "Checking for new posts in " + timer + "..." : "Checking for new posts...") : "Page is over." }} </button>`,
    data() {
        return {
            timer: timerLength,
            ajaxHappening: false,
            pageEnded: false,
            timerInterval: null
        }
    },
    mounted() {
        this.checkPageEnded()

        this.timerInterval = setInterval(() => {
            if (this.pageEnded) {
                let [newPageURL, newPageNum] = this.getNextPage()

                [
                    document.querySelector(".postpagnation.above .pagnationcomponent"),
                    document.querySelector(".postpagnation.below .pagnationcomponent")
                ].forEach(pagination => {
                    let hasURL = false
                    for (let i = 0; i < pagination.children.length; i++) {
                        if (newPageURL.match(pagination.children[i].href)) {
                            hasURL = true
                            break
                        }
                    }

                    if (!hasURL) {
                        let newPageLink = document.createElement("a")
                        newPageLink.href = newPageURL
                        newPageLink.className = "page"
                        newPageLink.innerHTML = `<span>${newPageNum}</span>`

                        pagination.appendChild(newPageLink)
                    }
                })

                clearInterval(this.timerInterval)
                return
            }

            if (this.timer < 0 && !this.ajaxHappening) {
                let ajax = new XMLHttpRequest()
                ajax.onreadystatechange = () => {
                    if (ajax.readyState === XMLHttpRequest.DONE) {
                        if (ajax.status === 200) {
                            let parser = new DOMParser()
                            let pageDocument = parser.parseFromString(ajax.responseText, "text/html")
                            let newPostlist = pageDocument.querySelector('[class="postlist"]')

                            for (let i = 0; i < newPostlist.children.length; i++) {
                                if (!currentPostlist.children[i]) {
                                    let res = Vue.compile(newPostlist.children[i].outerHTML)

                                    let post = new Vue({
                                        render: res.render,
                                        staticRenderFns: res.staticRenderFns
                                    }).$mount()

                                    // By the way, the "unread" banner gets added as well but apparently never after, thanks to the children index checking. That's convenient..?

                                    currentPostlist.appendChild(post.$el)
                                    console.log("Added new new post! ", post.$el)
                                }
                            }

                            this.checkPageEnded()

                            this.timer = timerLength
                            this.ajaxHappening = false
                        }
                    }
                }
                ajax.open("GET", location.origin + location.pathname, true)
                ajax.send()

                this.ajaxHappening = true
            } else {
                this.timer--
            }
        }, 1000)
    },
    methods: {
        getNextPage() {
            let [_, path, pageNum] = new RegExp("(.*\/)([0-9]+)\/?$", "i").exec(location.origin + location.pathname)
            let newPageNum = (parseInt(pageNum) + 1)
            return [path + newPageNum, newPageNum]
        },
        checkPageEnded() {
            let [newPageURL] = this.getNextPage()
            if (newPageURL) {
                let ajax = new XMLHttpRequest()
                ajax.onreadystatechange = () => {
                    if (ajax.readyState === XMLHttpRequest.DONE) {
                        if (ajax.responseURL === newPageURL) {
                            this.pageEnded = true
                        }
                    }
                }
                ajax.open("GET", newPageURL, true)
                ajax.send()
            }
        }
    }
}).$mount()

let threadReplyButtons = document.querySelector('.threadreply .actions .field')
threadReplyButtons.insertBefore(refresher.$el, threadReplyButtons.children[0])

console.log("Loaded auto-refresh userscript!")
