class SnakePart {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
}

function createGame(options = {}) {
  const config = options || {};
  const doc = config.document;
  const canvasId = typeof config.canvasId === "string" ? config.canvasId.trim() : "game";
  const audioFactory = typeof config.audioFactory === "function" ? config.audioFactory : (src) => new Audio(src);
  const random = typeof config.random === "function" ? config.random : Math.random;
  const schedule = typeof config.setTimeoutFn === "function" ? config.setTimeoutFn : setTimeout;

  if (!doc) {
    throw new Error("document is required");
  }

  if (!canvasId) {
    throw new Error("canvasId is required");
  }

  if (!doc.body || typeof doc.body.addEventListener !== "function") {
    throw new Error("document.body with addEventListener is required");
  }

  const canvas = doc.getElementById(canvasId);
  if (!canvas) {
    throw new Error(`canvas "${canvasId}" was not found`);
  }

  const ctx = typeof canvas.getContext === "function" ? canvas.getContext("2d") : null;
  if (!ctx) {
    throw new Error("2d context is required");
  }

  let speed = 7;
  const tileCount = 20;
  const tileSize = canvas.width / tileCount - 2;
  let headX = 10;
  let headY = 10;
  let snakeParts = [];
  let tailLength = 2;
  let appleX = 5;
  let appleY = 5;
  let inputsXVelocity = 0;
  let inputsYVelocity = 0;
  let xVelocity = 0;
  let yVelocity = 0;
  let score = 0;
  const gulpSound = audioFactory("gulp.mp3");

  function drawGame() {
    xVelocity = inputsXVelocity;
    yVelocity = inputsYVelocity;

    changeSnakePosition();
    const result = isGameOver();
    if (result) {
      return true;
    }

    clearScreen();
    checkAppleCollision();
    drawApple();
    drawSnake();
    drawScore();

    if (score > 5) {
      speed = 9;
    }
    if (score > 10) {
      speed = 11;
    }

    schedule(drawGame, 1000 / speed);
    return false;
  }

  function isGameOver() {
    let gameOver = false;

    if (yVelocity === 0 && xVelocity === 0) {
      return false;
    }

    if (headX < 0) {
      gameOver = true;
    } else if (headX === tileCount) {
      gameOver = true;
    } else if (headY < 0) {
      gameOver = true;
    } else if (headY === tileCount) {
      gameOver = true;
    }

    for (let i = 0; i < snakeParts.length; i++) {
      const part = snakeParts[i];
      if (part.x === headX && part.y === headY) {
        gameOver = true;
        break;
      }
    }

    if (gameOver) {
      ctx.fillStyle = "white";
      ctx.font = "50px Verdana";

      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop("0", " magenta");
      gradient.addColorStop("0.5", "blue");
      gradient.addColorStop("1.0", "red");
      ctx.fillStyle = gradient;
      ctx.fillText("Game Over!", canvas.width / 6.5, canvas.height / 2);
      ctx.fillText("Game Over!", canvas.width / 6.5, canvas.height / 2);
    }

    return gameOver;
  }

  function drawScore() {
    ctx.fillStyle = "white";
    ctx.font = "10px Verdana";
    ctx.fillText("Score " + score, canvas.width - 50, 10);
  }

  function clearScreen() {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawSnake() {
    ctx.fillStyle = "green";
    for (let i = 0; i < snakeParts.length; i++) {
      const part = snakeParts[i];
      ctx.fillRect(part.x * tileCount, part.y * tileCount, tileSize, tileSize);
    }

    snakeParts.push(new SnakePart(headX, headY));
    while (snakeParts.length > tailLength) {
      snakeParts.shift();
    }

    ctx.fillStyle = "orange";
    ctx.fillRect(headX * tileCount, headY * tileCount, tileSize, tileSize);
  }

  function changeSnakePosition() {
    headX = headX + xVelocity;
    headY = headY + yVelocity;
  }

  function drawApple() {
    ctx.fillStyle = "red";
    ctx.fillRect(appleX * tileCount, appleY * tileCount, tileSize, tileSize);
  }

  function checkAppleCollision() {
    if (appleX === headX && appleY === headY) {
      appleX = Math.floor(random() * tileCount);
      appleY = Math.floor(random() * tileCount);
      tailLength++;
      score++;

      if (gulpSound && typeof gulpSound.play === "function") {
        gulpSound.play();
      }

      return true;
    }

    return false;
  }

  function keyDown(event) {
    if (!event || typeof event.keyCode !== "number") {
      return false;
    }

    if (event.keyCode === 38 || event.keyCode === 87) {
      if (inputsYVelocity === 1) {
        return false;
      }
      inputsYVelocity = -1;
      inputsXVelocity = 0;
      return true;
    }

    if (event.keyCode === 40 || event.keyCode === 83) {
      if (inputsYVelocity === -1) {
        return false;
      }
      inputsYVelocity = 1;
      inputsXVelocity = 0;
      return true;
    }

    if (event.keyCode === 37 || event.keyCode === 65) {
      if (inputsXVelocity === 1) {
        return false;
      }
      inputsYVelocity = 0;
      inputsXVelocity = -1;
      return true;
    }

    if (event.keyCode === 39 || event.keyCode === 68) {
      if (inputsXVelocity === -1) {
        return false;
      }
      inputsYVelocity = 0;
      inputsXVelocity = 1;
      return true;
    }

    return false;
  }

  function init(autoStart = true) {
    doc.body.addEventListener("keydown", keyDown);
    if (autoStart) {
      drawGame();
    }
  }

  function getState() {
    return {
      speed,
      tileCount,
      tileSize,
      headX,
      headY,
      snakeParts,
      tailLength,
      appleX,
      appleY,
      inputsXVelocity,
      inputsYVelocity,
      xVelocity,
      yVelocity,
      score
    };
  }

  function setState(nextState = {}) {
    if (Object.prototype.hasOwnProperty.call(nextState, "speed")) speed = nextState.speed;
    if (Object.prototype.hasOwnProperty.call(nextState, "headX")) headX = nextState.headX;
    if (Object.prototype.hasOwnProperty.call(nextState, "headY")) headY = nextState.headY;
    if (Object.prototype.hasOwnProperty.call(nextState, "snakeParts")) snakeParts = nextState.snakeParts;
    if (Object.prototype.hasOwnProperty.call(nextState, "tailLength")) tailLength = nextState.tailLength;
    if (Object.prototype.hasOwnProperty.call(nextState, "appleX")) appleX = nextState.appleX;
    if (Object.prototype.hasOwnProperty.call(nextState, "appleY")) appleY = nextState.appleY;
    if (Object.prototype.hasOwnProperty.call(nextState, "inputsXVelocity")) inputsXVelocity = nextState.inputsXVelocity;
    if (Object.prototype.hasOwnProperty.call(nextState, "inputsYVelocity")) inputsYVelocity = nextState.inputsYVelocity;
    if (Object.prototype.hasOwnProperty.call(nextState, "xVelocity")) xVelocity = nextState.xVelocity;
    if (Object.prototype.hasOwnProperty.call(nextState, "yVelocity")) yVelocity = nextState.yVelocity;
    if (Object.prototype.hasOwnProperty.call(nextState, "score")) score = nextState.score;
  }

  return {
    canvas,
    ctx,
    drawGame,
    isGameOver,
    drawScore,
    clearScreen,
    drawSnake,
    changeSnakePosition,
    drawApple,
    checkAppleCollision,
    keyDown,
    init,
    getState,
    setState
  };
}

/* istanbul ignore else */
if (typeof module !== "undefined" && module.exports) {
  module.exports = { createGame, SnakePart };
}

/* istanbul ignore next */
if (typeof window !== "undefined" && typeof document !== "undefined") {
  createGame({ document }).init();
}
