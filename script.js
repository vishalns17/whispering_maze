// =================================================
// SETUP: Get elements and define game state
// =================================================
document.addEventListener('DOMContentLoaded', () => {

const gameContainer = document.getElementById('game-container');
const captionBox = document.getElementById('caption-box');
const proximitySound = document.getElementById('proximity-sound');
const foundSound = document.getElementById('found-sound');
// At the top of script.js
const bumpSound = document.getElementById('bump-sound');

// ADD these four new lines:
const upSound = document.getElementById('up-sound');
const downSound = document.getElementById('down-sound');
const leftSound = document.getElementById('left-sound');
const rightSound = document.getElementById('right-sound');

// At the top of script.js
let playerElement;

let mazeLayout;
let mazeSize;
const player = { x: 0, y: 0 };
const treasure = { x: 0, y: 0 };
let treasureFound = false;
let userHasInteracted = false;
// At the top of script.js, with your other variables
let distanceMap;
let maxPathDistance;
// Web Audio API for spatial panning
let audioContext, panner, source;


// =================================================
// MAZE GENERATION
// =================================================

// REPLACE your old generateMaze function with this one.
/**
 * Generates a random maze and optionally simplifies it by removing walls.
 * @param {number} size - The width and height of the maze (must be an odd number).
 * @param {number} simplification - The number of walls to attempt to remove.
 * @returns {Array<Array<number>>} The generated maze layout.
 */
function generateMaze(size, simplification = 0) {
    if (size % 2 === 0) size++;

    // ... (The entire first part of the maze generation remains the same) ...
    const maze = Array(size).fill(0).map(() => Array(size).fill(1));
    const stack = [];
    let startX = Math.floor(Math.random() * (size / 2)) * 2 + 1;
    let startY = Math.floor(Math.random() * (size / 2)) * 2 + 1;
    maze[startY][startX] = 0;
    stack.push([startX, startY]);
    while (stack.length > 0) {
        const [cx, cy] = stack[stack.length - 1];
        const directions = [[0, -2], [0, 2], [-2, 0], [2, 0]];
        directions.sort(() => Math.random() - 0.5);
        let foundNeighbor = false;
        for (const [dx, dy] of directions) {
            const [nx, ny] = [cx + dx, cy + dy];
            if (ny > 0 && ny < size - 1 && nx > 0 && nx < size - 1 && maze[ny][nx] === 1) {
                maze[ny - dy / 2][nx - dx / 2] = 0;
                maze[ny][nx] = 0;
                stack.push([nx, ny]);
                foundNeighbor = true;
                break;
            }
        }
        if (!foundNeighbor) {
            stack.pop();
        }
    }

    // NEW: Simplify the maze by removing walls to reduce dead ends
    for (let i = 0; i < simplification; i++) {
        // Pick a random interior point
        const rx = Math.floor(Math.random() * (size - 2)) + 1;
        const ry = Math.floor(Math.random() * (size - 2)) + 1;

        // If it's a wall that separates two paths, knock it down.
        if (maze[ry][rx] === 1) {
            // Check for horizontal paths
            if (maze[ry][rx - 1] === 0 && maze[ry][rx + 1] === 0) {
                maze[ry][rx] = 0;
            }
            // Check for vertical paths
            else if (maze[ry - 1][rx] === 0 && maze[ry + 1][rx] === 0) {
                maze[ry][rx] = 0;
            }
        }
    }

    return maze;
}


/**
 * Calculates the shortest path from a start node to all other reachable nodes in the maze.
 * Uses the Breadth-First Search (BFS) algorithm.
 * @param {Array<Array<number>>} layout - The current maze layout.
 * @param {object} startNode - The node to start from {x, y}.
 * @returns {object} An object containing the distance map and the maximum distance found.
 */
function calculateDistanceMap(layout, startNode) {
    const size = layout.length;
    const distances = Array(size).fill(0).map(() => Array(size).fill(Infinity));
    const queue = [startNode];
    let maxDistance = 0;

    // The distance from the start node (treasure) to itself is 0
    distances[startNode.y][startNode.x] = 0;

    while (queue.length > 0) {
        const { x, y } = queue.shift(); // Get the next node to process

        // Check all four neighbors (N, E, S, W)
        const directions = [{ y: -1, x: 0 }, { y: 0, x: 1 }, { y: 1, x: 0 }, { y: 0, x: -1 }];
        for (const dir of directions) {
            const nextX = x + dir.x;
            const nextY = y + dir.y;

            // Check if the neighbor is valid, is not a wall, and has not been visited yet
            if (nextY >= 0 && nextY < size && nextX >= 0 && nextX < size &&
                layout[nextY][nextX] !== 1 && distances[nextY][nextX] === Infinity) {

                // Update distance and add to the queue to visit later
                const newDistance = distances[y][x] + 1;
                distances[nextY][nextX] = newDistance;
                if (newDistance > maxDistance) {
                    maxDistance = newDistance;
                }
                queue.push({ x: nextX, y: nextY });
            }
        }
    }

    return { distances, maxDistance };
}

// =================================================
// GAME LOGIC: Rendering and state changes
// =================================================

/**
 * Renders the entire maze grid based on the current state.
 */
function renderMaze() {
    gameContainer.innerHTML = '';
    gameContainer.style.gridTemplateColumns = `repeat(${mazeSize}, 1fr)`;
    gameContainer.style.gridTemplateRows = `repeat(${mazeSize}, 1fr)`;

    for (let y = 0; y < mazeSize; y++) {
        for (let x = 0; x < mazeSize; x++) {
            const cell = document.createElement('div');
            cell.classList.add('grid-cell');

            // Inside the renderMaze() function...
            if (x === player.x && y === player.y) {
                cell.classList.add('player', 'player-idle'); // Set the initial state to idle
                playerElement = cell; // Assign the element to our variable
            } else {
                //... the rest of the function
                switch (mazeLayout[y][x]) {
                    case 1: cell.classList.add('wall'); break;
                    case 0: cell.classList.add('path'); break;
                    case 3: cell.classList.add('treasure'); break;
                    default: cell.classList.add('path');
                }
            }
            gameContainer.appendChild(cell);
        }
    }
}

/**
 * Checks if the player is on the treasure; handles collection.
 */
function checkTreasure() {
    if (treasureFound) return;

    if (player.x === treasure.x && player.y === treasure.y) {
        treasureFound = true;
        mazeLayout[player.y][player.x] = 0;
        proximitySound.pause();
        foundSound.play();
        captionBox.textContent = "Chime! You found the treasure!";
        gameContainer.style.boxShadow = '0 0 30px #f1c40f';

        renderMaze();

        setTimeout(() => {
            gameContainer.innerHTML = '<h2>YOU WIN!</h2>';
            captionBox.textContent = 'Thank you for playing! 🎉';
        }, 2000);
    }
}


// =================================================
// ACCESSIBILITY CUES: The core feedback loop
// =================================================
// REPLACE your old updateAccessibilityCues function with this one.
/**
 * Updates audio volume/panning and visual glow based on player proximity to the treasure.
 */
function updateAccessibilityCues() {
    if (treasureFound || !userHasInteracted) return;

    // NEW: Get distance from the pre-calculated pathfinding map
    const distance = distanceMap[player.y][player.x];

    // --- Audio Cue ---
    // Volume increases as player gets closer (inverse relationship with true path distance)
    const volume = Math.max(0, 1 - (distance / maxPathDistance));
    proximitySound.volume = volume * volume; // Squaring makes the falloff more dramatic

    // --- Spatial Pan Cue (this can remain the same, based on direct line-of-sight) ---
    if (panner) {
        const panValue = (player.x - treasure.x) / (mazeSize / 2);
        panner.pan.value = -panValue;
    }

    // --- Visual Cue ---
    const glowIntensity = volume * 25;
    gameContainer.style.boxShadow = `0 0 ${glowIntensity}px #f1c40f`;

    // --- Text Caption Cue ---
    if (distance <= maxPathDistance * 0.15) { // If in the closest 15% of the path
        captionBox.textContent = "You're very close!";
    } else if (distance <= maxPathDistance * 0.4) { // If in the closest 40%
        captionBox.textContent = "You're on the right path...";
    } else if (distance === Infinity) { // If on a path disconnected from the treasure (unlikely with this generator)
        captionBox.textContent = "This seems like a dead end...";
    } else {
        captionBox.textContent = "Explore the maze to find the treasure...";
    }
}

// =================================================
// EVENT LISTENERS AND INITIALIZATION
// =================================================

/**
 * Handles player movement via arrow keys.
 */
document.addEventListener('keydown', (e) => {
    if (treasureFound) return;

    let newX = player.x;
    let newY = player.y;

    switch (e.key) {
        case 'ArrowUp': newY--; break;
        case 'ArrowDown': newY++; break;
        case 'ArrowLeft': newX--; break;
        case 'ArrowRight': newX++; break;
        default: return;
    }

    e.preventDefault();

    // Check for wall collision before moving
    if (mazeLayout[newY] && mazeLayout[newY][newX] !== 1) {

        if (playerElement) {
        playerElement.classList.remove('player-idle');
        playerElement.classList.add('player-running');

        setTimeout(() => {
            playerElement.classList.remove('player-running');
            playerElement.classList.add('player-idle');
        }, 500);
        }
        player.x = newX;
        player.y = newY;
        renderMaze();
        updateAccessibilityCues();
        checkTreasure();
    } else {
        // NEW: Play a sound if the move is blocked by a wall or boundary
        if (userHasInteracted) {
            bumpSound.currentTime = 0; // Rewind the sound to play again if hit rapidly
            bumpSound.play();
        }
    }
});
// Add this new event listener in the EVENT LISTENERS section
/**
 * Handles the "Sonar Ping" to check for open paths.
 */
// REPLACE your current spacebar event listener with this one.
/**
 * Handles the "Sonar Ping" to check for open paths with directional audio.
 * Sounds are played one-by-one in a clear sequence.
 */
document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || treasureFound) return;

    e.preventDefault(); // Stop spacebar from scrolling the page

    // N, E, S, W directions to check
    const directions = [
        { y: -1, x: 0 }, // North (Up)
        { y: 0, x: 1 },  // East (Right)
        { y: 1, x: 0 },  // South (Down)
        { y: 0, x: -1 },  // West (Left)
    ];

    // Corresponds to the directions array above
    const directionSounds = [upSound, rightSound, downSound, leftSound];

    // This loop uses setTimeout to play sounds sequentially.
    directions.forEach((dir, index) => {
        // The timeout creates a sequential, distinct sound for each direction
        setTimeout(() => {
            const checkX = player.x + dir.x;
            const checkY = player.y + dir.y;

            // Get the correct sound for the current direction
            const soundToPlay = directionSounds[index];

            // If the direction is not a wall, play its unique ping
            if (mazeLayout[checkY] && mazeLayout[checkY][checkX] !== 1) {
                soundToPlay.currentTime = 0; // Rewind sound
                soundToPlay.play();
                console.log(`Ping in direction: ${index} (${dir.x}, ${dir.y})`);
            }
        }, index * 500); // 150ms delay between each directional ping
    });
});
/**
 * One-time listener to initialize audio after the first user interaction.
 */
document.addEventListener('keydown', () => {
    if (!userHasInteracted) {
        userHasInteracted = true;

        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        source = audioContext.createMediaElementSource(proximitySound);
        panner = audioContext.createStereoPanner();
        source.connect(panner).connect(audioContext.destination);

        proximitySound.play().catch(error => console.error("Audio play failed:", error));
        updateAccessibilityCues();
    }
}, { once: true });

// REPLACE your old initializeGame function with this one.
/**
 * Initializes or resets the game.
 */

// REPLACE your old initializeGame function with this one.
/**
 * Initializes or resets the game based on the chosen difficulty.
 * @param {string} difficulty - 'easy' or 'hard'.
 */
function initializeGame(difficulty) {
    // 1. Set parameters based on difficulty
    let simplification = 0;
    if (difficulty === 'easy') {
        mazeSize = 11; // Smaller maze
        simplification = 20; // More loops, fewer dead ends
    } else { // hard
        mazeSize = 17; // Larger maze
        simplification = 0; // A "perfect" maze with many dead ends
    }

    // 2. Generate maze using new parameters
    mazeLayout = generateMaze(mazeSize, simplification);

    // ... (The rest of the function remains the same as before) ...
    const emptySpots = [];
    for (let y = 0; y < mazeSize; y++) {
        for (let x = 0; x < mazeSize; x++) {
            if (mazeLayout[y][x] === 0) { emptySpots.push({ x, y }); }
        }
    }
    let playerIndex = Math.floor(Math.random() * emptySpots.length);
    let { x: px, y: py } = emptySpots.splice(playerIndex, 1)[0];
    player.x = px;
    player.y = py;
    let treasureIndex;
    let tx, ty;
    do {
        treasureIndex = Math.floor(Math.random() * emptySpots.length);
        ({ x: tx, y: ty } = emptySpots[treasureIndex]);
    } while (Math.abs(px - tx) + Math.abs(py - ty) < mazeSize / 2);
    treasure.x = tx;
    treasure.y = ty;
    mazeLayout[player.y][player.x] = 2;
    const { distances, maxDistance } = calculateDistanceMap(mazeLayout, treasure);
    distanceMap = distances;
    maxPathDistance = maxDistance;
    treasureFound = false;
    captionBox.textContent = "Use arrow keys to find the treasure!";
    mazeLayout[treasure.y][treasure.x] = 3;
    renderMaze();

    // Show the game and hide the difficulty screen
    document.getElementById('difficulty-selection').style.display = 'none';
    document.getElementById('game-wrapper').style.display = 'block';
}

// NEW: Add event listeners for the difficulty buttons
document.getElementById('easy-btn').addEventListener('click', () => initializeGame('easy'));
document.getElementById('hard-btn').addEventListener('click', () => initializeGame('hard'));

// REMOVE the old initializeGame() call from the bottom of your script.

// Start the game!
// initializeGame();   

});