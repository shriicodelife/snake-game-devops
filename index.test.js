const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { createGame, SnakePart } = require("./index");

function buildGame(overrides = {}) {
  const calls = {
    fillRect: [],
    fillText: [],
    gradients: [],
    addEventListener: [],
    setTimeout: [],
    play: 0
  };

  const gradient = {
    addColorStop: jest.fn((offset, color) => {
      calls.gradients.push([offset, color]);
    })
  };

  const ctx = {
    fillStyle: "",
    font: "",
    fillRect: jest.fn((...args) => calls.fillRect.push(args)),
    fillText: jest.fn((...args) => calls.fillText.push(args)),
    createLinearGradient: jest.fn(() => gradient)
  };

  const canvas = {
    width: 400,
    height: 400,
    getContext: jest.fn(() => ctx)
  };

  const document = {
    body: {
      addEventListener: jest.fn((...args) => calls.addEventListener.push(args))
    },
    getElementById: jest.fn(() => canvas)
  };

  const audio = {
    play: jest.fn(() => {
      calls.play += 1;
    })
  };

  const game = createGame({
    document,
    audioFactory: overrides.audioFactory || (() => audio),
    random: overrides.random || (() => 0.4),
    setTimeoutFn: overrides.setTimeoutFn || ((fn, delay) => calls.setTimeout.push([fn, delay])),
    canvasId: Object.prototype.hasOwnProperty.call(overrides, "canvasId") ? overrides.canvasId : "game"
  });

  return { game, calls, ctx, canvas, document, audio };
}

describe("SnakePart", () => {
  test("stores coordinates", () => {
    const part = new SnakePart(2, 3);
    expect(part).toEqual({ x: 2, y: 3 });
  });

  test("browser bootstrap auto-initializes when window and document exist", () => {
    const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
    const addEventListener = jest.fn();
    const fillRect = jest.fn();
    const fillText = jest.fn();
    const createLinearGradient = jest.fn(() => ({ addColorStop: jest.fn() }));
    const getContext = jest.fn(() => ({
      fillStyle: "",
      font: "",
      fillRect,
      fillText,
      createLinearGradient
    }));

    const context = {
      window: {},
      document: {
        body: { addEventListener },
        getElementById: jest.fn(() => ({
          width: 400,
          height: 400,
          getContext
        }))
      },
      Audio: function Audio() {
        return { play: jest.fn() };
      },
      setTimeout: jest.fn(),
      console
    };

    vm.runInNewContext(source, context);

    expect(addEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));
    expect(context.setTimeout).toHaveBeenCalledTimes(1);
  });
});

describe("createGame setup guards", () => {
  test("throws when document is undefined", () => {
    expect(() => createGame()).toThrow("document is required");
  });

  test("throws when document is null", () => {
    expect(() => createGame(null)).toThrow("document is required");
  });

  test("throws when canvasId is an empty string", () => {
    expect(() =>
      createGame({
        document: {
          body: { addEventListener: jest.fn() },
          getElementById: jest.fn()
        },
        canvasId: "   "
      })
    ).toThrow('canvasId is required');
  });

  test("throws when body is missing", () => {
    expect(() =>
      createGame({
        document: {
          getElementById: jest.fn()
        }
      })
    ).toThrow("document.body with addEventListener is required");
  });

  test("throws when addEventListener is missing", () => {
    expect(() =>
      createGame({
        document: {
          body: {},
          getElementById: jest.fn()
        }
      })
    ).toThrow("document.body with addEventListener is required");
  });

  test("throws when canvas is missing", () => {
    expect(() =>
      createGame({
        document: {
          body: { addEventListener: jest.fn() },
          getElementById: jest.fn(() => null)
        }
      })
    ).toThrow('canvas "game" was not found');
  });

  test("throws when 2d context is missing", () => {
    expect(() =>
      createGame({
        document: {
          body: { addEventListener: jest.fn() },
          getElementById: jest.fn(() => ({
            getContext: jest.fn(() => null)
          }))
        }
      })
    ).toThrow("2d context is required");
  });

  test("throws when canvas does not expose getContext", () => {
    expect(() =>
      createGame({
        document: {
          body: { addEventListener: jest.fn() },
          getElementById: jest.fn(() => ({
            width: 400,
            height: 400
          }))
        }
      })
    ).toThrow("2d context is required");
  });

  test("uses default canvasId, Audio, random, and setTimeout dependencies", () => {
    const originalAudio = global.Audio;
    const originalRandom = Math.random;
    const originalSetTimeout = global.setTimeout;
    const play = jest.fn();
    const scheduled = [];

    global.Audio = jest.fn(() => ({ play }));
    Math.random = jest.fn(() => 0.2);
    global.setTimeout = jest.fn((fn, delay) => scheduled.push([fn, delay]));

    try {
      const document = {
        body: { addEventListener: jest.fn() },
        getElementById: jest.fn(() => ({
          width: 400,
          height: 400,
          getContext: jest.fn(() => ({
            fillStyle: "",
            font: "",
            fillRect: jest.fn(),
            fillText: jest.fn(),
            createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() }))
          }))
        }))
      };

      const game = createGame({ document });
      game.setState({ headX: 5, headY: 5 });
      expect(game.checkAppleCollision()).toBe(true);
      expect(global.Audio).toHaveBeenCalledWith("gulp.mp3");
      expect(play).toHaveBeenCalledTimes(1);

      game.setState({ inputsXVelocity: 1, inputsYVelocity: 0 });
      game.drawGame();
      expect(global.setTimeout).toHaveBeenCalledTimes(1);
    } finally {
      global.Audio = originalAudio;
      Math.random = originalRandom;
      global.setTimeout = originalSetTimeout;
    }
  });
});

describe("game behavior", () => {
  test("init registers the keydown handler and can skip auto start", () => {
    const { game, calls } = buildGame();
    game.init(false);
    expect(calls.addEventListener).toEqual([["keydown", game.keyDown]]);
    expect(calls.setTimeout).toHaveLength(0);
  });

  test("init defaults auto start to true", () => {
    const { game, calls } = buildGame();
    game.init();
    expect(calls.setTimeout).toHaveLength(1);
  });

  test("init with auto start schedules the next frame", () => {
    const { game, calls } = buildGame();
    game.init(true);
    expect(calls.setTimeout).toHaveLength(1);
  });

  test("keyDown returns false for null, undefined, and malformed events", () => {
    const { game } = buildGame();
    expect(game.keyDown(null)).toBe(false);
    expect(game.keyDown(undefined)).toBe(false);
    expect(game.keyDown({})).toBe(false);
    expect(game.keyDown({ keyCode: "38" })).toBe(false);
  });

  test("keyDown handles up and blocks reversing from down", () => {
    const { game } = buildGame();
    expect(game.keyDown({ keyCode: 38 })).toBe(true);
    expect(game.getState().inputsYVelocity).toBe(-1);
    expect(game.getState().inputsXVelocity).toBe(0);

    game.setState({ inputsYVelocity: 1 });
    expect(game.keyDown({ keyCode: 87 })).toBe(false);
    expect(game.getState().inputsYVelocity).toBe(1);
  });

  test("keyDown handles down and blocks reversing from up", () => {
    const { game } = buildGame();
    expect(game.keyDown({ keyCode: 40 })).toBe(true);
    expect(game.getState().inputsYVelocity).toBe(1);
    expect(game.getState().inputsXVelocity).toBe(0);

    game.setState({ inputsYVelocity: -1 });
    expect(game.keyDown({ keyCode: 83 })).toBe(false);
    expect(game.getState().inputsYVelocity).toBe(-1);
  });

  test("keyDown handles left and blocks reversing from right", () => {
    const { game } = buildGame();
    expect(game.keyDown({ keyCode: 37 })).toBe(true);
    expect(game.getState().inputsXVelocity).toBe(-1);
    expect(game.getState().inputsYVelocity).toBe(0);

    game.setState({ inputsXVelocity: 1 });
    expect(game.keyDown({ keyCode: 65 })).toBe(false);
    expect(game.getState().inputsXVelocity).toBe(1);
  });

  test("keyDown handles right and blocks reversing from left", () => {
    const { game } = buildGame();
    expect(game.keyDown({ keyCode: 39 })).toBe(true);
    expect(game.getState().inputsXVelocity).toBe(1);
    expect(game.getState().inputsYVelocity).toBe(0);

    game.setState({ inputsXVelocity: -1 });
    expect(game.keyDown({ keyCode: 68 })).toBe(false);
    expect(game.getState().inputsXVelocity).toBe(-1);
  });

  test("keyDown ignores unrelated keys", () => {
    const { game } = buildGame();
    expect(game.keyDown({ keyCode: 13 })).toBe(false);
  });

  test("setState handles empty input and full state replacement", () => {
    const { game } = buildGame();
    const initial = game.getState();

    game.setState();
    expect(game.getState()).toEqual(initial);

    const parts = [new SnakePart(1, 1)];
    game.setState({
      speed: 8,
      headX: 2,
      headY: 3,
      snakeParts: parts,
      tailLength: 4,
      appleX: 6,
      appleY: 7,
      inputsXVelocity: 1,
      inputsYVelocity: -1,
      xVelocity: 1,
      yVelocity: -1,
      score: 9
    });

    expect(game.getState()).toMatchObject({
      speed: 8,
      headX: 2,
      headY: 3,
      snakeParts: parts,
      tailLength: 4,
      appleX: 6,
      appleY: 7,
      inputsXVelocity: 1,
      inputsYVelocity: -1,
      xVelocity: 1,
      yVelocity: -1,
      score: 9
    });
  });

  test("changeSnakePosition updates the head coordinates", () => {
    const { game } = buildGame();
    game.setState({ headX: 4, headY: 5, xVelocity: 2, yVelocity: -3 });
    game.changeSnakePosition();
    expect(game.getState().headX).toBe(6);
    expect(game.getState().headY).toBe(2);
  });

  test("clearScreen paints the full canvas black", () => {
    const { game, ctx, canvas } = buildGame();
    game.clearScreen();
    expect(ctx.fillStyle).toBe("black");
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, canvas.width, canvas.height);
  });

  test("drawScore renders the score text", () => {
    const { game, ctx, canvas } = buildGame();
    game.setState({ score: 12 });
    game.drawScore();
    expect(ctx.fillStyle).toBe("white");
    expect(ctx.font).toBe("10px Verdana");
    expect(ctx.fillText).toHaveBeenCalledWith("Score 12", canvas.width - 50, 10);
  });

  test("drawApple renders the apple tile", () => {
    const { game, ctx } = buildGame();
    game.setState({ appleX: 2, appleY: 3 });
    game.drawApple();
    expect(ctx.fillStyle).toBe("red");
    expect(ctx.fillRect).toHaveBeenCalledWith(40, 60, 18, 18);
  });

  test("drawSnake renders body and trims tail length", () => {
    const { game, ctx } = buildGame();
    game.setState({
      headX: 4,
      headY: 5,
      tailLength: 2,
      snakeParts: [new SnakePart(1, 1), new SnakePart(2, 2)]
    });

    game.drawSnake();

    expect(ctx.fillRect).toHaveBeenCalledWith(20, 20, 18, 18);
    expect(ctx.fillRect).toHaveBeenCalledWith(40, 40, 18, 18);
    expect(ctx.fillRect).toHaveBeenCalledWith(80, 100, 18, 18);
    expect(game.getState().snakeParts).toEqual([new SnakePart(2, 2), new SnakePart(4, 5)]);
  });

  test("checkAppleCollision returns false when there is no collision", () => {
    const { game, audio } = buildGame();
    expect(game.checkAppleCollision()).toBe(false);
    expect(game.getState().score).toBe(0);
    expect(audio.play).not.toHaveBeenCalled();
  });

  test("checkAppleCollision updates state and plays audio on collision", () => {
    const { game, audio } = buildGame({ random: () => 0.3 });
    game.setState({ headX: 5, headY: 5 });

    expect(game.checkAppleCollision()).toBe(true);
    expect(game.getState()).toMatchObject({
      appleX: 6,
      appleY: 6,
      tailLength: 3,
      score: 1
    });
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  test("checkAppleCollision tolerates missing audio objects", () => {
    const { game } = buildGame({ audioFactory: () => null });
    game.setState({ headX: 5, headY: 5 });
    expect(game.checkAppleCollision()).toBe(true);
    expect(game.getState().score).toBe(1);
  });

  test("checkAppleCollision tolerates audio objects without play", () => {
    const { game } = buildGame({ audioFactory: () => ({}) });
    game.setState({ headX: 5, headY: 5 });
    expect(game.checkAppleCollision()).toBe(true);
    expect(game.getState().score).toBe(1);
  });

  test("isGameOver returns false before the snake starts moving", () => {
    const { game } = buildGame();
    game.setState({ headX: -1, headY: 10, xVelocity: 0, yVelocity: 0 });
    expect(game.isGameOver()).toBe(false);
  });

  test("isGameOver detects left wall collisions", () => {
    const { game, ctx, calls } = buildGame();
    game.setState({ headX: -1, xVelocity: 1, yVelocity: 0 });
    expect(game.isGameOver()).toBe(true);
    expect(ctx.createLinearGradient).toHaveBeenCalled();
    expect(calls.gradients).toEqual([
      ["0", " magenta"],
      ["0.5", "blue"],
      ["1.0", "red"]
    ]);
    expect(calls.fillText).toHaveLength(2);
  });

  test("isGameOver detects right wall collisions", () => {
    const { game } = buildGame();
    game.setState({ headX: 20, xVelocity: 1, yVelocity: 0 });
    expect(game.isGameOver()).toBe(true);
  });

  test("isGameOver detects top wall collisions", () => {
    const { game } = buildGame();
    game.setState({ headY: -1, xVelocity: 0, yVelocity: 1 });
    expect(game.isGameOver()).toBe(true);
  });

  test("isGameOver detects bottom wall collisions", () => {
    const { game } = buildGame();
    game.setState({ headY: 20, xVelocity: 0, yVelocity: 1 });
    expect(game.isGameOver()).toBe(true);
  });

  test("isGameOver detects self collisions", () => {
    const { game } = buildGame();
    game.setState({
      headX: 3,
      headY: 4,
      xVelocity: 1,
      yVelocity: 0,
      snakeParts: [new SnakePart(1, 1), new SnakePart(3, 4)]
    });
    expect(game.isGameOver()).toBe(true);
  });

  test("isGameOver returns false when moving without collisions", () => {
    const { game } = buildGame();
    game.setState({
      headX: 3,
      headY: 4,
      xVelocity: 1,
      yVelocity: 0,
      snakeParts: [new SnakePart(1, 1), new SnakePart(2, 4)]
    });
    expect(game.isGameOver()).toBe(false);
  });

  test("drawGame stops immediately on game over", () => {
    const { game, calls } = buildGame();
    game.setState({ headX: 0, headY: 10, inputsXVelocity: -1, inputsYVelocity: 0 });
    expect(game.drawGame()).toBe(true);
    expect(calls.setTimeout).toHaveLength(0);
  });

  test("drawGame schedules using speed 9 when score is above 5", () => {
    const { game, calls } = buildGame();
    game.setState({
      score: 6,
      inputsXVelocity: 1,
      inputsYVelocity: 0,
      xVelocity: 0,
      yVelocity: 0,
      headX: 10,
      headY: 10
    });

    expect(game.drawGame()).toBe(false);
    expect(game.getState().speed).toBe(9);
    expect(calls.setTimeout[0][1]).toBeCloseTo(1000 / 9);
  });

  test("drawGame schedules using speed 11 when score is above 10", () => {
    const { game, calls } = buildGame();
    game.setState({
      score: 11,
      inputsXVelocity: 1,
      inputsYVelocity: 0,
      xVelocity: 0,
      yVelocity: 0,
      headX: 10,
      headY: 10
    });

    expect(game.drawGame()).toBe(false);
    expect(game.getState().speed).toBe(11);
    expect(calls.setTimeout[0][1]).toBeCloseTo(1000 / 11);
  });
});
