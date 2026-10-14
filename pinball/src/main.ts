import './style.css';
import { Game } from './game/Game';

const root = document.querySelector<HTMLDivElement>('#app')!;
const game = new Game(root);
game.start();

// 開発サーバーのときだけ、ブラウザのコンソールから状態を見られるようにする
if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;
