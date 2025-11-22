// import { Link } from 'react-router-dom'; // Hidden for now
import { Button } from '@primer/react';
import './Home.scss';

export default function Home() {
  return (
    <div className="home-page">
      {/* Main Hero Section */}
      <section className="hero-section">
        <video 
          className="hero-video"
          autoPlay
          poster="https://cdn.steamstatic.com/apps/dota2/images/dota_react/kez/kez_header_loop_poster.png"
          preload='auto'
          loop
          muted
          playsInline
        >
          <source src="https://cdn.steamstatic.com/apps/dota2/videos/dota_react/kez/kez_header_loop.webm" type="video/webm" />
        </video>
        
        <div className="hero-content">
          <h1 className="hero-title">
            <span className="title-word">SUB</span>
            <span className="title-word">WARS</span>
            <span className="title-word">V</span>
          </h1>
          
          <h2 className="hero-subheading">THE ULTIMATE SHOWDOWN</h2>
          
          <div className="hero-description">
            <span className="hosted-by">Hosted by PasoLL</span>
            <span className="description-text">, SUB WARS V brings together players and fans for an epic Dota 2 community tournament like never before. This is the biggest open-for-all Dota 2 event of the year — players from Herald to Immortal can participate and experience true competitive action.</span>
          </div>
          

          <div className="hero-actions">
            <a 
              href="https://forms.gle/bu5rEYGYBc97aszN7" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hero-button-link"
            >
              <Button variant="primary" className="hero-button">
                REGISTER FOR SUB WARS V
              </Button>
            </a>
          </div>
        </div>

        {/* Features Container */}
        <div className="features-container">
          <h2 className="features-title">The Ultimate Showdown</h2>
          
          <p className="features-description">
          Watch top-tier, exciting gameplay, experience adrenaline-packed matchups, and cheer on your friends as the community comes together for an action-filled SUB WARS V packed with strategy, hype, and unforgettable moments.
          </p>

          {/* Feature Section 1 - Text Left, Image Right */}
          <div className="feature-section">
            <div className="feature-text">
              <h3 className="feature-section-title">Live Stream</h3>
              <p className="feature-section-description">
              Join hundreds of viewers as India’s Dota 2 community comes together for a one-of-a-kind event featuring player comms, intense community clashes, and participation from all ranks — from Herald to Immortal.
              </p>
            </div>
            <div className="feature-image">
              <img src="https://cdn.steamstatic.com/apps/dota2/images/dota_react//winter2023/ward.png" alt="Live Stream" />
            </div>
          </div>

          {/* Feature Section 2 - Image Left, Text Right */}
          <div className="feature-section feature-section-reverse">
            <div className="feature-text">
              <h3 className="feature-section-title">Guss The Hero & Giveaways</h3>
              <p className="feature-section-description">
              Dive into the Guess the Hero Contest during SUB WARS V and win big even without playing in the tournament! Open to the entire community, this contest lets you test your Dota 2 knowledge live, race up the leaderboard, and claim exciting prizes. Stand a chance to win gaming products, Steam Wallet codes, and tons of surprise giveaways.
              </p>
            </div>
            <div className="feature-image">
              <img src="https://cdn.steamstatic.com/apps/dota2/images/dota_react//springcleaning2025/performance/performance.png" alt="Audience Quiz" />
            </div>
          </div>

          {/* Stats Section */}
          <div className="stats-section">
            <h2 className="stats-title">SUB WARS By The Numbers</h2>
            <div className="stats-grid">
              <div className="stat-item stat-item-featured">
                <div className="stat-value">₹4,00,000+</div>
                <div className="stat-label">Cumulative Prize Pool</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">2,00,000+</div>
                <div className="stat-label">Watch Hours</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">50,000+</div>
                <div className="stat-label">Total Views</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">15,000+</div>
                <div className="stat-label">Unique Viewers</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">6,000+</div>
                <div className="stat-label">Community Members</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">350+</div>
                <div className="stat-label">Peak Viewers</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">100+</div>
                <div className="stat-label">Giveaways</div>
              </div>
            </div>
          </div>

          {/* Call to Action Section */}
          <div className="cta-section">
            <img 
              src="https://cdn.steamstatic.com/apps/dota2/images/dota_react/international2024/compendium/5hero_lockup.png" 
              alt="Hero lockup" 
              className="cta-bg-image"
            />
            <h2 className="cta-main-title">JOIN THE ULTIMATE SHOWDOWN</h2>
            <p className="cta-main-description">
            Join hundreds of players from Herald to Immortal in India’s most unique and biggest open-for-all Dota 2 event — SUB WARS V!
            </p>
            <a 
              href="https://forms.gle/bu5rEYGYBc97aszN7" 
              target="_blank" 
              rel="noopener noreferrer"
              className="cta-button-link"
            >
              <Button variant="primary" className="cta-button">
              REGISTER FOR SUB WARS V
              </Button>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
