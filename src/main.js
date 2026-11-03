import './style.css';
import { GameManager } from './game/GameManager.js';
import { createUI } from './ui/render.js';

createUI(new GameManager());
