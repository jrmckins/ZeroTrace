# ZeroTrace

**Take control of your digital footprint.**

ZeroTrace is a Chrome extension designed to help you find, review, and remove your own activity across social-media platforms.

Whether you're cleaning up years of old posts, comments, likes, replies, or other activity, ZeroTrace gives you one place to manage your digital footprint.

## 🚀 Features

### Facebook

* Review your Facebook activity
* Find posts and comments you've created
* Remove unwanted activity
* Navigate directly to relevant Facebook activity

### X / Twitter

* Review your posts and replies
* Find comments and interactions
* Remove unwanted activity
* Navigate directly to your profile and posts

### Reddit

Coming soon.

Planned Reddit cleanup includes:

* Posts
* Comments and replies
* Saved content
* Votes
* Community subscriptions
* Followed users
* Profile information

## 🎯 Why ZeroTrace?

Over the years, most people accumulate thousands of social-media interactions.

Old posts, comments, replies, likes, and other activity can remain online long after you've forgotten about them.

ZeroTrace is designed to make that cleanup easier.

**Find it. Review it. Remove it.**

## 🔒 Privacy First

ZeroTrace is designed around the principle that your social-media activity should remain under your control.

ZeroTrace does **not** need your social-media passwords.

The extension works with your existing logged-in browser sessions rather than asking you to provide your credentials.

> ZeroTrace is intended to help you manage your own content and activity. It does not provide access to other people's private information or content.

## 🧩 Supported Platforms

| Platform    | Status            |
| ----------- | ----------------- |
| Facebook    | ✅ Available       |
| X / Twitter | ✅ Available       |
| Reddit      | 🚧 In development |
| YouTube     | 🔜 Planned        |
| Instagram   | 🔜 Planned        |
| TikTok      | 🔜 Planned        |
| LinkedIn    | 🔜 Planned        |
| Threads     | 🔜 Planned        |
| Bluesky     | 🔜 Planned        |

Additional platforms may be added over time.

## 🛠️ Installation

### Development Installation

1. Clone or download this repository.

2. Open Chrome.

3. Navigate to:

   `chrome://extensions`

4. Enable **Developer mode**.

5. Click **Load unpacked**.

6. Select the ZeroTrace project directory.

7. ZeroTrace will appear in your Chrome extensions.

## 💻 Development

ZeroTrace is a Chrome extension built with JavaScript, HTML, and CSS.

### Project Structure

```text
ZeroTrace/
├── background.js
├── manifest.json
├── popup.html
├── popup.js
├── platforms/
│   ├── facebook.js
│   └── twitter.js
├── icon16.png
├── icon48.png
├── icon128.png
└── README.md
```

Platform-specific functionality is organized into the `platforms/` directory so that additional social networks can be added without rewriting the core extension.

## 🗺️ Roadmap

### Phase 1 — Core Platforms

* [x] Facebook
* [x] X / Twitter

### Phase 2 — High-Value Cleanup

* [ ] Reddit
* [ ] YouTube
* [ ] Instagram
* [ ] TikTok
* [ ] LinkedIn

### Phase 3 — Additional Platforms

* [ ] Threads
* [ ] Bluesky
* [ ] Pinterest
* [ ] Mastodon
* [ ] Discord
* [ ] Telegram
* [ ] Truth Social

### Future Features

* Activity scanning
* Activity counts
* Date-based cleanup
* Keyword filtering
* Platform-specific cleanup rules
* Review-before-delete mode
* Bulk cleanup
* Cleanup progress tracking
* Cleanup history
* Multi-platform dashboard

## ⚠️ Important

ZeroTrace is intended to help users manage **their own** social-media activity.

Platform interfaces, APIs, policies, and terms of service can change. Automated actions may not be supported by every platform.

ZeroTrace should respect the rules and technical limitations of each platform it supports.

Users should review content before permanently deleting it.

**Deleted content may not be recoverable.**

## 🤝 Contributing

Contributions, bug reports, feature requests, and platform integrations are welcome.

Before contributing a new platform, consider:

1. What user activity can legitimately be managed?
2. Does the platform provide an official API?
3. Does the platform permit the proposed automation?
4. What happens when content is deleted?
5. Can the feature be implemented without collecting user credentials or unnecessary personal data?

## 📄 License

License information will be added as the project develops.

---

## ZeroTrace

**Your digital history. Your choice.**

Find it.
Review it.
Remove it.

