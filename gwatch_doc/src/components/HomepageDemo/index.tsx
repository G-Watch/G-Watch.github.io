import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

import React, { useState, useEffect } from 'react';

const TerminalTyping = () => {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState("root@xtrah100 $ ".length);
  const [showCursor, setShowCursor] = useState(true);
  const [typingComplete, setTypingComplete] = useState(false);
  

  const textToType = `root@xtra_h100 $ gwatch python3 train.py`;
  const typingSpeed = 100;

  useEffect(() => {
    if (currentIndex < textToType.length) {
      const timer = setTimeout(() => {
        setDisplayText(textToType.slice(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, typingSpeed);
      return () => clearTimeout(timer);
    } else {
      const completeTimer = setTimeout(() => {
        setTypingComplete(true);
      }, 2000);
      return () => clearTimeout(completeTimer);
    }
  }, [currentIndex, textToType]);

  useEffect(() => {
    const cursorTimer = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 500);
    return () => clearInterval(cursorTimer);
  }, []);

  return (
    <div className={styles.terminalContainer}>
      <div 
        className={styles.terminalArea}
        style={{
          opacity: typingComplete ? 0 : 1,
          transform: typingComplete ? 'scale(0.95)' : 'scale(1)',
          transition: 'all 1s ease-in-out'
        }}
      >
        <div className={styles.terminalWrapper}>
          <div className={styles.terminal}>
            <div className={styles.titleBar}>
              <div className={styles.titleBarContent}>
                <div className={styles.dot} style={{backgroundColor: '#ef4444'}}></div>
                <div className={styles.dot} style={{backgroundColor: '#eab308'}}></div>
                <div className={styles.dot} style={{backgroundColor: '#22c55e'}}></div>
                <span className={styles.titleText}>
                  Terminal
                </span>
              </div>
            </div>

            <div className={styles.terminalContent}>
              <pre className={styles.preText}>
                <span className={styles.glowText}>
                  {displayText}
                </span>
                <span 
                  className={styles.cursor}
                  style={{
                    opacity: showCursor ? 1 : 0,
                    transition: 'opacity 0.1s ease-in-out'
                  }}
                >
                  ▋
                </span>
              </pre>
            </div>
          </div>
        </div>
      </div>

      <div 
        className={styles.videoContainer}
        style={{
          opacity: typingComplete ? 0.5 : 0,
          transform: typingComplete ? 'scale(1)' : 'scale(1.1)',
          transition: 'all 1s ease-in-out'
        }}
      >
        <video
          className={styles.video}
          autoPlay
          loop
          muted
          playsInline
        >
          <source src="/path/to/your/video.mp4" type="video/mp4" />
          <source src="/path/to/your/video.mov" type="video/quicktime" />
        </video>
      </div>


    </div>
  );
};

export default function HomepageDemo(): ReactNode {
  return (
        <TerminalTyping />
  );
}
