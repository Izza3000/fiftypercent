import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CoffeeScene from '../components/CoffeeScene';
import LoadingScreen from '../components/LoadingScreen';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import '../styles/landing.css';

gsap.registerPlugin(ScrollTrigger);

const LandingPage = () => {
  const [activeCard, setActiveCard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Loading screen timer
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500); // 1.5 seconds for loading screen

    // Initial animations - now will start after loading screen
    const timeline = gsap.timeline({
      delay: 1.5 // Start after loading screen
    });
    
    timeline.from('.fade-in', {
      opacity: 0,
      y: 50,
      duration: 1.2,
      stagger: 0.3,
      ease: 'power4.out',
    }).to('.fade-in', {
      opacity: 1,
      y: 0,
      duration: 0,
    });

    // Scroll animations for cards with permanent visibility
    gsap.from('.feature-card', {
      scrollTrigger: {
        trigger: '.feature-card',
        start: 'top center+=100',
        toggleActions: 'play none none none', // Changed to prevent reversal
      },
      opacity: 0,
      y: 100,
      duration: 1,
      stagger: 0.2,
      ease: 'power3.out',
    });

    // Stats counter animation
    const statsTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: '.stats-section',
        start: 'top center+=100',
        toggleActions: 'play none none none', // Changed to prevent reversal
      }
    });

    statsTimeline.from('.stat-number', {
      textContent: 0,
      duration: 2,
      ease: 'power1.out',
      snap: { textContent: 1 },
      stagger: 0.2,
    });

    // Animate the hero text gradient
    gsap.to('.gradient-text', {
      backgroundPosition: '200% center',
      duration: 15,
      repeat: -1,
      ease: 'none',
      delay: 1.5 // Start after loading screen
    });

    return () => {
      clearTimeout(timer);
      // Clear all ScrollTrigger instances when component unmounts
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, []);

  const handleCardHover = (index) => {
    setActiveCard(index);
    gsap.to(`.card-${index}`, {
      scale: 1.05,
      duration: 0.3,
      ease: 'power2.out'
    });
  };

  const handleCardLeave = (index) => {
    setActiveCard(null);
    gsap.to(`.card-${index}`, {
      scale: 1,
      duration: 0.3,
      ease: 'power2.out'
    });
  };

  return (
    <>
      {isLoading && <LoadingScreen />}
      <div className={`relative min-h-screen bg-[#1a0f0c] overflow-hidden transition-opacity duration-500 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a0f0c] via-[#2c1810] to-[#1a0f0c] z-0" />
        <CoffeeScene />
        
        {/* Content overlay */}
        <div className="relative z-10">
          {/* Navigation */}
          <nav className="bg-[#0a0605]/90 backdrop-blur-md border-b border-white/20 sticky top-0">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex-shrink-0 flex items-center">
                  <h1 className="text-2xl font-bold text-white tracking-wider hover:scale-105 transition-transform duration-300">
                    Coffee<span className="text-green-400">Farmer</span>
                  </h1>
                </div>
                <div className="flex items-center space-x-6">
                  <Link
                    to="/login"
                    className="text-white hover:text-green-400 px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 hover:scale-105 relative after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 hover:after:w-full after:bg-green-400 after:transition-all after:duration-300"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="bg-green-500 text-white hover:bg-green-400 px-6 py-2 rounded-md text-sm font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-green-500/30 border border-green-400/30"
                  >
                    Sign Up
                  </Link>
                </div>
              </div>
            </div>
          </nav>

          {/* Hero Section */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24">
            <div className="text-center">
              <h1 className="fade-in !opacity-100 gradient-text text-6xl md:text-7xl font-extrabold mb-8 tracking-tight drop-shadow-2xl">
                Cultivate Success in Every Bean
              </h1>
              <p className="fade-in !opacity-100 text-xl md:text-2xl text-white mb-12 max-w-3xl mx-auto leading-relaxed font-medium drop-shadow-lg">
                Join the future of coffee farming with our intelligent management platform.
                Track, analyze, and optimize your coffee production like never before.
              </p>
              
              {/* Feature Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
                {[
                  {
                    icon: "🌱",
                    title: "Smart Farming",
                    description: "Get real-time insights and recommendations for optimal crop management.",
                    color: "from-green-500/30 to-green-600/30",
                    hover: "hover:from-green-500/40 hover:to-green-600/40"
                  },
                  {
                    icon: "📊",
                    title: "Data Analytics",
                    description: "Track your farm's performance with advanced analytics and reporting tools.",
                    color: "from-blue-500/30 to-blue-600/30",
                    hover: "hover:from-blue-500/40 hover:to-blue-600/40"
                  },
                  {
                    icon: "🌍",
                    title: "Sustainable Growth",
                    description: "Implement sustainable farming practices for better yield and quality.",
                    color: "from-amber-500/30 to-amber-600/30",
                    hover: "hover:from-amber-500/40 hover:to-amber-600/40"
                  }
                ].map((feature, index) => (
                  <div
                    key={index}
                    className={`feature-card !opacity-100 fade-in card-${index} bg-gradient-to-br ${feature.color} ${feature.hover} backdrop-blur-xl rounded-xl p-8 text-left border border-white/20 hover:border-white/30 transition-all duration-500 cursor-pointer shadow-lg hover:shadow-xl`}
                    onMouseEnter={() => handleCardHover(index)}
                    onMouseLeave={() => handleCardLeave(index)}
                  >
                    <div className="text-5xl mb-4 transform transition-all duration-500 hover:scale-110 hover:rotate-12">{feature.icon}</div>
                    <h3 className="text-white text-xl font-bold mb-3">{feature.title}</h3>
                    <p className="text-white/90">{feature.description}</p>
                  </div>
                ))}
              </div>

              {/* Team Members Section */}
              <div className="stats-section !opacity-100 fade-in grid grid-cols-1 md:grid-cols-5 gap-8 mt-20 text-center">
                {[
                  { name: "Jebeah Eve S. Barriento", role: "Team Member" },
                  { name: "Angelo L. Cawa", role: "Team Member" },
                  { name: "Riza June C. Espino", role: "Team Member" },
                  { name: "Jelena Jane A. Montuya", role: "Team Member" },
                  { name: "Denielle James S. Sombiro", role: "Team Member" }
                ].map((member, index) => (
                  <div key={index} className="bg-white/10 hover:bg-white/15 rounded-lg p-6 backdrop-blur-sm border border-white/20 transition-all duration-300 hover:scale-105 hover:shadow-lg">
                    <div className="text-xl font-bold text-green-400 mb-2">{member.name}</div>
                    <div className="text-white/80 font-medium">{member.role}</div>
                  </div>
                ))}
              </div>

              {/* CTA Section */}
              <div className="fade-in !opacity-100 mt-20">
                <Link
                  to="/register"
                  className="group inline-flex items-center px-8 py-4 text-lg font-bold rounded-full bg-gradient-to-r from-green-500 to-green-400 text-white hover:from-green-400 hover:to-green-300 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-green-500/30 border border-green-400/30"
                >
                  Start Your Journey
                  <svg className="w-5 h-5 ml-2 transform transition-transform duration-300 group-hover:translate-x-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <p className="mt-4 text-white/80 font-medium">
                  Join hundreds of successful coffee farmers today
                </p>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
};

export default LandingPage;