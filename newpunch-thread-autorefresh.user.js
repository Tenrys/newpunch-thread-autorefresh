// ==UserScript==
// @name         Newpunch Thread Auto-refresh
// @namespace    tenrys.pw
// @version      0.5.7
// @description  Checks for new posts in a thread on an interval and adds them to the page dynamically.
// @author       Tenrys (https://github.com/Tenrys/newpunch-thread-autorefresh)
// @include      https://forum.facepunch.com/*
// @include      http://forum.facepunch.com/*
// ==/UserScript==

let currentPostlist = document.querySelector('[class="postlist"]')

// Check if we're in a thread
if (!currentPostlist) return

var refresher = new Vue({
    template: String.raw`<button class="button is-dark" disabled title="Thread refresher"> {{ !pageEnded ? (timer > 0 ? "Checking for new posts in " + timer + "..." : "Checking for new posts...") : "Page is over." }} </button>`,
    data() {
        return {
            timer: 10,
            timerLength: 10,
            ajaxHappening: false,
            pageEnded: false,
            originalPageTitle: document.title,
            updatedOnce: false,

            timerInterval: null,
            newPostCount: 0,
        }
    },
    mounted() {
        this.setupNotifications()

        this.checkPageEnded()

        this.timerInterval = setInterval(() => {
            if (this.pageEnded && this.updatedOnce) {
                if ("Notification" in window && Notification.permission == "granted") {
                    let notification = new Notification(this.originalPageTitle, {
                        body: "Page has ended, click to go to new page",
                        tag: "page-ended",
                    })
                    notification.onclick = () => {
                        window.location = this.getNextPage()[0]
                    }
                }

                clearInterval(this.timerInterval)
                return
            }

            this.refreshPage()
        }, 1000)

        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState == "visible") {
                this.newPostCount = 0
                document.title = this.originalPageTitle
            }
        })
    },
    methods: {
        getNextPage() {
            let [_, path, pageNum] = /(.*\/)([0-9]+)\/?$/i.exec(location.origin + location.pathname)
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

                            let [newPageURL, newPageNum] = this.getNextPage()

                            [
                                document.querySelector(".postpagnation.above .pagnationcomponent"),
                                document.querySelector(".postpagnation.below .pagnationcomponent")
                            ].forEach(pagination => {
                                let hasURL = false
                                for (let i = 0; i < pagination.children.length; i++) {
                                    if (newPageURL == pagination.children[i].href) {
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
                        }
                    }
                }
                ajax.open("GET", newPageURL, true)
                ajax.send()
            }
        },
        refreshPage() {
            if (this.timer < 0 && !this.ajaxHappening) {
                let ajax = new XMLHttpRequest()
                ajax.onreadystatechange = () => {
                    if (ajax.readyState === XMLHttpRequest.DONE) {
                        if (ajax.status === 200) {
                            let parser = new DOMParser()
                            let pageDocument = parser.parseFromString(ajax.responseText, "text/html")

                            // Add new posts to current postlist
                            let newPostlist = pageDocument.querySelector('[class="postlist"]')
                            let addedPost = false
                            for (let i = 0; i < newPostlist.children.length; i++) {
                                if (!currentPostlist.children.namedItem(newPostlist.children[i].id)) {
                                    let res = Vue.compile(newPostlist.children[i].outerHTML)

                                    let pageTitle = this.originalPageTitle
                                    let post = new Vue({
                                        render: res.render,
                                        staticRenderFns: res.staticRenderFns,
                                        mounted() {
                                            if (this.$el.id === "unseen") return

                                            this.$nextTick(() => {
                                                if ("Notification" in window && Notification.permission == "granted") {
                                                    let followingButton = document.querySelector(".threadsubscribe span.is-primary a")

                                                    if (followingButton.classList.contains("is-primary")) {
                                                        // To-do: service worker..? Check how much interest there is

                                                        let postrender = document.querySelector(`#${this.$el.id} .postrender`).__vue__

                                                        let notification = new Notification(pageTitle, {
                                                            body: `New post from ${postrender.username}!`,
                                                            icon: postrender.avatar,
                                                            tag: `new-post-${this.$el.id}`,
                                                            vibrate: [200, 100, 200] // This won't be used but whatever
                                                        })
                                                        notification.onclick = () => {
                                                            if (this.$el.scrollIntoView) this.$el.scrollIntoView()
                                                        }
                                                    }
                                                }
                                            })
                                        }
                                    }).$mount()

                                    // By the way, the "unread" banner gets added as well but apparently never after, thanks to the children index checking. That's convenient..?

                                    currentPostlist.appendChild(post.$el)

                                    if (!document.hasFocus()) {
                                        if (post.$el.id !== "unseen") {
                                            this.newPostCount++
                                        }
                                        document.title = `(${this.newPostCount}) ${this.originalPageTitle}`
                                    }

                                    addedPost = true
                                    this.updatedOnce = true
                                    console.log("Added new post! ", post.$el)
                                }
                            }
                            if (!addedPost) {
                                this.timerLength = Math.min(this.timerLength + 5, 120)
                            } else {
                                this.timerLength = 10
                            }

                            this.checkPageEnded()

                            this.timer = this.timerLength
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
        },
        setupNotifications() {
            if (!("Notification" in window)) {
                console.warn("Thread auto-refresher userscript: This browser does not support desktop notifications")
            } else if (Notification.permission !== "denied") {
                Notification.requestPermission()
            }
        }
    }
}).$mount()

let threadReplyButtons = document.querySelector('.threadreply .actions .field')
threadReplyButtons.insertBefore(refresher.$el, threadReplyButtons.children[0])

console.log("Loaded auto-refresh userscript!")
