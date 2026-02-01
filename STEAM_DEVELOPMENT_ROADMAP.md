# Brimstone Valley - Steam Release Development Roadmap

**Current Version:** v1.0 (Local Multiplayer Only)  
**Target:** Full Steam Release with Single Player & Online Multiplayer  
**Last Updated:** January 11, 2026

---

## 📋 PHASE 1: AI Development (Single Player vs Computer)
**Goal:** Implement AI opponent for single-player mode  
**Estimated Time:** 3-4 weeks

### 1.1 AI Foundation (Week 1)
- [ ] Create `src/ai/` directory structure
- [ ] Design AI difficulty levels (Easy, Medium, Hard)
- [ ] Implement basic decision-making framework
  - Draft phase AI (hero selection strategy)
  - Movement phase AI (positioning logic)
  - Spell casting priorities

### 1.2 AI Draft Logic (Week 2)
- [ ] Hero tier list and synergy analysis
- [ ] Counter-picking strategy
- [ ] Ban phase decision making
- [ ] Team composition balancing (front/mid/back row)

### 1.3 AI Battle Logic (Week 2-3)
- [ ] Spell priority system
  - Target selection (highest health, lowest health, buffs, etc.)
  - Energy management
  - Spell efficiency calculations
- [ ] Movement decision making
  - Repositioning to safety
  - Offensive positioning
  - Protecting vulnerable heroes
- [ ] Threat assessment system

### 1.4 AI Difficulty Tuning (Week 3-4)
- [ ] Easy: Random decisions with basic logic
- [ ] Medium: Decent strategy, some mistakes
- [ ] Hard: Optimal play, advanced tactics
- [ ] Testing and balance adjustments

### 1.5 UI Updates for Single Player
- [ ] Add "vs Computer" mode to start screen
- [ ] AI difficulty selection screen
- [ ] Single-player game flow integration
- [ ] Victory/defeat screens with stats

---

## 📋 PHASE 2: Backend Infrastructure (Online Multiplayer)
**Goal:** Set up server infrastructure for online play  
**Estimated Time:** 4-5 weeks

### 2.1 Technology Stack Selection (Week 1)
**Recommended Stack:**
- **Backend:** Node.js + Express + Socket.io (for real-time game state)
- **Database:** PostgreSQL or MongoDB (for user accounts, match history)
- **Authentication:** JWT tokens or Steam Auth API
- **Hosting:** AWS/Google Cloud/Azure or dedicated game server hosting
- **Alternative:** Firebase (simpler, managed solution)

### 2.2 Server Architecture (Week 1-2)
- [ ] Set up Node.js server
- [ ] Implement WebSocket connections (Socket.io)
- [ ] Create game room management system
- [ ] Design matchmaking queue
- [ ] Implement game state synchronization
- [ ] Handle disconnections and reconnections

### 2.3 Database Schema (Week 2)
- [ ] User accounts table
- [ ] Match history table
- [ ] Player statistics (wins/losses, ELO rating)
- [ ] Friend lists
- [ ] Hero unlock/progression (if applicable)

### 2.4 Authentication System (Week 2-3)
- [ ] User registration/login
- [ ] Steam account integration
- [ ] Guest accounts (for testing)
- [ ] Session management

### 2.5 Game Server Logic (Week 3-4)
- [ ] Server-side game validation
  - Prevent cheating
  - Validate all moves and spell casts
  - Synchronize game state
- [ ] Turn timer implementation
- [ ] Draft phase networking
- [ ] Battle phase networking
- [ ] Movement phase networking

### 2.6 Matchmaking System (Week 4-5)
- [ ] Quick match (random opponent)
- [ ] Ranked matches (ELO-based)
- [ ] Custom lobbies
- [ ] Friend invites
- [ ] Spectator mode (optional)

---

## 📋 PHASE 3: Online Client Integration
**Goal:** Connect frontend to backend  
**Estimated Time:** 3-4 weeks

### 3.1 Network Layer (Week 1)
- [ ] Create `src/network/` directory
- [ ] Socket.io client integration
- [ ] Connection state management
- [ ] Reconnection logic
- [ ] Message queue for unreliable connections

### 3.2 Online Game Flow (Week 2)
- [ ] Lobby system UI
- [ ] Matchmaking UI (searching, found, countdown)
- [ ] Sync game state with server
- [ ] Handle opponent actions in real-time
- [ ] Latency compensation

### 3.3 UI Updates for Online Mode (Week 2-3)
- [ ] "Multiplayer Online" button functional
- [ ] Login/registration screens
- [ ] Main menu with player profile
- [ ] Friend list
- [ ] Match history viewer
- [ ] Leaderboards

### 3.4 Error Handling (Week 3)
- [ ] Connection lost UI
- [ ] Opponent disconnected handling
- [ ] Server error messages
- [ ] Timeout handling

### 3.5 Testing (Week 4)
- [ ] Local network testing
- [ ] Online testing with multiple clients
- [ ] Stress testing (concurrent games)
- [ ] Latency testing

---

## 📋 PHASE 4: Steam Integration
**Goal:** Prepare for Steam platform  
**Estimated Time:** 2-3 weeks

### 4.1 Steamworks SDK Setup (Week 1)
- [ ] Register as Steam Partner
- [ ] Set up Steamworks account
- [ ] Download and integrate Steamworks SDK
- [ ] Implement Steam authentication
- [ ] Test Steam overlay

### 4.2 Steam Features (Week 1-2)
- [ ] Achievements system
- [ ] Steam Leaderboards
- [ ] Steam Cloud saves
- [ ] Trading cards (optional)
- [ ] Workshop support (custom heroes/effects - optional)

### 4.3 Steam Store Page (Week 2)
- [ ] Create compelling store description
- [ ] Design capsule images (header, library, etc.)
- [ ] Create trailer/gameplay video
- [ ] Screenshot gallery
- [ ] Feature list

### 4.4 Platform-Specific Features (Week 2-3)
- [ ] Steam friends integration
- [ ] Steam invites
- [ ] Rich presence (show what player is doing)
- [ ] Controller support
- [ ] Big Picture mode compatibility

---

## 📋 PHASE 5: Build & Packaging
**Goal:** Create distributable executable  
**Estimated Time:** 2-3 weeks

### 5.1 Technology Choice
**Recommended: Electron**
- Convert React app to Electron desktop app
- Bundles Node.js, Chromium, and your code
- Cross-platform (Windows, Mac, Linux)
- Good for web-based games

**Alternative: Tauri** (lighter weight)

### 5.2 Electron Setup (Week 1)
- [ ] Install Electron
- [ ] Create main process entry point
- [ ] Configure build scripts
- [ ] Set up auto-updater
- [ ] Bundle assets and dependencies

### 5.3 Optimization (Week 1-2)
- [ ] Code minification
- [ ] Asset compression
- [ ] Remove console logs
- [ ] Performance profiling
- [ ] Memory leak testing
- [ ] Loading screen optimization

### 5.4 Build Pipeline (Week 2)
- [ ] Windows build (`.exe`)
- [ ] Mac build (`.dmg`)
- [ ] Linux build (`.AppImage` or `.deb`)
- [ ] Steam build configuration
- [ ] Auto-update mechanism

### 5.5 Testing Builds (Week 2-3)
- [ ] Test on multiple machines
- [ ] Test different OS versions
- [ ] Test with/without Steam
- [ ] Test install/uninstall
- [ ] Beta testing program

---

## 📋 PHASE 6: Content & Polish
**Goal:** Final touches before release  
**Estimated Time:** 3-4 weeks

### 6.1 Additional Content
- [ ] Tutorial/How to Play
- [ ] More heroes (balance the roster)
- [ ] Sound effects and music
- [ ] Improved VFX/animations
- [ ] Lore/story elements (optional)

### 6.2 UI/UX Polish
- [ ] Settings menu (graphics, audio, controls)
- [ ] Accessibility options
- [ ] Keyboard shortcuts
- [ ] Controller remapping
- [ ] Tooltips and help text

### 6.3 Balance & Testing
- [ ] Hero balance pass
- [ ] Spell balance adjustments
- [ ] Playtesting with real players
- [ ] Bug fixing marathon
- [ ] Performance optimization

### 6.4 Localization (Optional)
- [ ] Identify target languages
- [ ] Translation pipeline
- [ ] Test in different languages

---

## 📋 PHASE 7: Pre-Launch & Marketing
**Goal:** Build awareness and prepare for launch  
**Estimated Time:** 4-6 weeks

### 7.1 Marketing Materials (Week 1-2)
- [ ] Game trailer
- [ ] Gameplay videos
- [ ] Developer diary/blog posts
- [ ] Social media accounts (Twitter, Discord, Reddit)
- [ ] Press kit

### 7.2 Community Building (Week 1-4)
- [ ] Create Discord server
- [ ] Reddit community
- [ ] Closed beta program
- [ ] Content creators outreach
- [ ] Steam wishlist campaign

### 7.3 Steam Launch Prep (Week 3-4)
- [ ] Submit build for review
- [ ] Set pricing
- [ ] Configure regional pricing
- [ ] Plan launch discount
- [ ] Schedule release date

### 7.4 Launch Week (Week 5-6)
- [ ] Monitor server stability
- [ ] Rapid bug fixing
- [ ] Community engagement
- [ ] Gather feedback
- [ ] Plan first patch

---

## 🎯 CRITICAL PATH SUMMARY

### Minimum Viable Product (MVP) for Steam:
1. ✅ **Local Multiplayer** (DONE)
2. **Single Player AI** (Phase 1)
3. **Online Multiplayer** (Phases 2-3)
4. **Steam Integration** (Phase 4)
5. **Packaged Executable** (Phase 5)

### Optional But Recommended:
- Achievements and leaderboards
- Tutorial mode
- Sound and music
- Additional heroes and balance

### Total Estimated Timeline:
- **Core Features (Phases 1-5):** 14-19 weeks (~3.5-5 months)
- **Polish & Launch (Phases 6-7):** 7-10 weeks (~2-2.5 months)
- **TOTAL:** 5-7 months for full Steam release

---

## 💰 COST ESTIMATES

### Infrastructure Costs:
- **Steam Partner Fee:** $100 (one-time, per game)
- **Server Hosting:** $20-100/month (depends on player count)
- **Domain Name:** $10-15/year
- **SSL Certificate:** $0-50/year (can use Let's Encrypt for free)
- **Development Tools:** Minimal (most are free/open source)

### Optional Costs:
- **Sound/Music:** $0-500 (royalty-free or commission)
- **Art Assets:** $0-1000+ (if commissioning)
- **Marketing:** $0-1000+ (ads, influencers)
- **Legal:** $0-500 (terms of service, privacy policy review)

---

## 🚀 RECOMMENDED NEXT STEPS

### Immediate (This Week):
1. ✅ Backup stable version (DONE)
2. Set up development priorities
3. Decide on AI difficulty levels
4. Start designing AI decision framework

### Short-term (Next 2 Weeks):
1. Begin Phase 1.1: AI Foundation
2. Research backend technology stack
3. Create game design document for AI behavior
4. Plan hero balance for competitive play

### Medium-term (Next Month):
1. Complete basic AI opponent
2. Test single-player gameplay
3. Begin server infrastructure planning
4. Register for Steam Partner program

---

## 📝 NOTES & CONSIDERATIONS

### Technical Decisions to Make:
1. **Backend hosting:** Self-hosted vs managed service (Firebase)?
2. **Monetization:** Premium (buy once) vs F2P with cosmetics?
3. **Hero unlock system:** All heroes available vs progression?
4. **Ranked system:** Simple win/loss or ELO rating?

### Risk Mitigation:
- Start with AI and local features (can ship without online initially)
- Use managed services (Firebase) to reduce server complexity
- Early Access on Steam to gather feedback and iterate
- Modular architecture allows adding features incrementally

### Success Metrics:
- Concurrent players
- Average session time
- Player retention (day 1, day 7, day 30)
- Review scores
- Revenue vs development cost

---

**Good luck with development! Remember: start small, iterate often, and ship early.**
