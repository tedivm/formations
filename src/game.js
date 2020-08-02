"use strict"

const TERRAIN_PLAIN = 0
const TERRAIN_SWAMP = 1
const TERRAIN_WALL = 2
const TERRAIN_WATER = 3


const THEMES = {
  "daylight": {
    0: "#089905",
    1: "#b4a476",
    2: "#000000",
    3: "#00d1ff"
  },

  "dusk": {
    0: "#252528",
    1: "#0a3609",
    2: "#000000",
    3: "#0e2679"
  },

  "night": {
    0: "#000000",
    1: "#000000",
    2: "#000000",
    3: "#000000"
  }
}

const TERRAIN_COLORS = THEMES["dusk"]

const TERRAIN_FATIGUE = {
  0: 1,
  1: 5,
}


const TOP = 1
const TOP_RIGHT = 2
const RIGHT = 3
const BOTTOM_RIGHT = 4
const BOTTOM = 5
const BOTTOM_LEFT = 6
const LEFT = 7
const TOP_LEFT = 8


const DIRECTION_MAP = {
  1: "TOP",
  2: "TOP_RIGHT",
  3: "RIGHT",
  4: "BOTTOM_RIGHT",
  5: "BOTTOM",
  6: "BOTTOM_LEFT",
  7: "LEFT",
  8: "TOP_LEFT",
}


const DIRECTIONS = Object.keys(DIRECTION_MAP)

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function uuid() {
  let dt = new Date().getTime();
  let uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (dt + Math.random()*16)%16 | 0
    dt = Math.floor(dt/16);
    return (c==='x' ? r :(r&0x3|0x8)).toString(16);
  })
  return uuid
}

function shuffle(listToShuffle) {
  for(let i = listToShuffle.length-1; i>0; i--){
    const j = Math.floor(Math.random() * i)
    const temp = listToShuffle[i]
    listToShuffle[i] = listToShuffle[j]
    listToShuffle[j] = temp
  }
  return listToShuffle
}




class GameEngine {

  constructor(canvas, opts={}) {
    this.canvas = canvas
    this.opts = Object.assign({}, {
      "backgroundColor": "#000000",
      "columns": 50,
      "rows": 50
    }, opts)
    console.log(JSON.stringify(this.opts))
    this.gameObjects = {}
    this.height = this.canvas.offsetHeight
    this.width = this.canvas.offsetWidth
    this.gridElementHeight = Math.floor(this.height / this.opts.rows)
    this.gridElementWidth = Math.floor(this.width / this.opts.columns)
    this.rooms = {
      "sim": new Room(this, this.opts.columns, this.opts.rows)
    }
    this.scripts = []
    this.scriptMemory = {}


    this.paths = []
  }

  addGameObject(gameObject) {
    this.gameObjects[gameObject.id] = gameObject
    return gameObject.id
  }

  getObjectById(id) {
    return this.gameObjects[id]
  }

  registerScript(script) {
    this.scripts[uuid()] = script
  }

  tick() {
    this.paths = []
    this.intents = {}
    for (const scriptId in this.scripts) {
      const script = this.scripts[scriptId]
      if (!this.scriptMemory[scriptId]) {
        this.scriptMemory[scriptId] = {}
      }
      script(scriptId, Game, this.scriptMemory[scriptId])
    }

    while (Object.keys(this.intents).length > 0) {
      // Pop a random intent off the queue.
      const IntendIdList = Object.keys(this.intents)
      const intentId = IntendIdList[Math.floor(Math.random() * IntendIdList.length)];
      const intent = this.intents[intentId]
      delete this.intents[intentId]


      try {
        intent.resolve(this, this.intents)
      } catch (error) {
        console.log(`Intent ${intentId} threw error: ${error}`)
        console.log(error.stack)
      }
    }

    for (const gameObject of Object.values(this.gameObjects)) {
      gameObject.upkeep()
    }

    for (const roomObject of Object.values(this.rooms)) {
      roomObject.upkeep()
    }
  }

  registerIntent(intent) {
    this.intents[intent.id] = intent
  }

  async run(opts = {}) {
    opts = Object.assign({
      "tickRate": 1000
    }, opts)
    while (true) {
      if (this.paused) {
        await sleep(opts.tickTime)
        this.draw()
        continue
      }
      console.time("tick")
      const start = Date.now()
      this.tick()
      this.draw()
      const elapsedTime = Date.now() - start
      const pauseTime = Math.max(3, opts.tickRate - elapsedTime)
      await sleep(pauseTime)
      console.timeEnd("tick")
    }
  }

  draw() {
    const ctx = this.canvas.getContext('2d')

    // Set Background
    ctx.save()
    ctx.clearRect(0, 0, this.width, this.height)
    if (this.opts.backgroundColor) {
      ctx.fillStyle = this.opts.backgroundColor
      ctx.fillRect(0, 0, this.width, this.height)
    }
    ctx.restore()

    // Set Terrain
    for (var x = 0; x < this.opts.columns; x++) {
      let row = ""
      for (var y = 0; y < this.opts.rows; y++) {
        //const type = getTerrainAt(x, y)
        const type = this.rooms["sim"].grid[x][y]
        row += type
        ctx.save()
        ctx.fillStyle = TERRAIN_COLORS[type]
        ctx.fillRect(
          x * this.gridElementWidth,
          y * this.gridElementHeight,
          this.gridElementWidth+1,
          this.gridElementHeight+1
        )
        ctx.restore()
      }
    }


    // Draw Paths
    for (const path of this.paths) {
      this.drawPath(path)
    }

    // Draw Objects
    for (const gameObject of Object.values(this.gameObjects)) {
      const pos = gameObject.getPosition()
      this.drawCircleInGrid(pos.x, pos.y, gameObject.getColor())
    }
  }

  drawCircleInGrid(x, y, color) {
    const ctx = this.canvas.getContext('2d')
    ctx.save()
    let radius = (this.gridElementWidth/2)*0.97
    if (radius < 1) {
      radius = 1
    }

    const centerX = (x * this.gridElementWidth) + (this.gridElementWidth/2)
    const centerY = (y * this.gridElementHeight) + (this.gridElementHeight/2)

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();

    // Give it a white border if there's enough space to
    if (Math.floor(this.gridElementWidth) > 4 && Math.floor(this.gridElementHeight) > 4) {
      ctx.lineWidth = this.gridElementWidth > 10 ? 2 : 1;
      ctx.strokeStyle = '#a2a2a2';
      ctx.stroke();
    }

    ctx.restore()
  }

  drawPath(path) {
    for (const piece of path) {
      this.drawCircleInGrid(piece.x, piece.y, "red")
    }
  }

}


class WorldView {
  constructor(canvas, game) {
    this.canvas = canvas
    this.game = game
    this.height = this.canvas.offsetHeight
    this.width = this.canvas.offsetWidth

    // Initialize to show the entire world.
    this.rows = this.game.opts.rows
    this.columns = this.game.opts.columns
  }

  draw() {
    const ctx = this.canvas.getContext('2d')
    this.gridElementHeight = this.height / this.rows
    this.gridElementWidth = this.width / this.columns

    // Set Background
    ctx.save()
    ctx.clearRect(0, 0, this.width, this.height)
    ctx.fillStyle = "000000"
    ctx.fillRect(0, 0, this.width, this.height)
    ctx.restore()

    // Set Terrain
    for (var x = 0; x < this.opts.columns; x++) {
      let row = ""
      for (var y = 0; y < this.opts.rows; y++) {
        //const type = getTerrainAt(x, y)
        const type = this.game.rooms["sim"].grid[x][y]
        row += type
        ctx.save()
        ctx.fillStyle = TERRAIN_COLORS[type]
        ctx.fillRect(
          x * this.gridElementWidth,
          y * this.gridElementHeight,
          this.gridElementWidth+1,
          this.gridElementHeight+1
        )
        ctx.restore()
      }
    }

    // Draw Paths
    for (const path of this.paths) {
      this.drawPath(path)
    }

    // Draw Objects
    for (const gameObject of Object.values(this.gameObjects)) {
      const pos = gameObject.getPosition()
      this.drawCircleInGrid(pos.x, pos.y, gameObject.getColor())
    }
  }

  drawCircleInGrid(x, y, color) {
    const ctx = this.canvas.getContext('2d')
    ctx.save()
    let radius = ((this.gridElementWidth-1)/2)*0.97
    if (radius < 1) {
      radius = 1
    }

    const centerX = (x * this.gridElementWidth) + (this.gridElementWidth/2)
    const centerY = (y * this.gridElementHeight) + (this.gridElementHeight/2)

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();

    // Give it a white border if there's enough space to
    if (Math.floor(this.gridElementWidth) > 4 && Math.floor(this.gridElementHeight) > 4) {
      ctx.lineWidth = this.gridElementWidth > 10 ? 2 : 1;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
    }

    ctx.restore()
  }

  drawPath(path) {
    for (const piece of path) {
      this.drawCircleInGrid(piece.x, piece.y, "red")
    }
  }

}


class Intent {
  resolve(intentQueue) {
    throw "Abstract method `resolve` has not been implimented."
  }
}

class MoveIntent extends Intent {

  constructor(creep, targetPosition) {
    super()
    this.creep = creep
    this.targetPosition = targetPosition
    this.type = "move"
    this.id = uuid()
  }

  resolve (game, intentQueue, alreadyChecked = []) {
    alreadyChecked.push(this.creep.id)
    if (this.creep.fatigue > 0) {
      return false
    }

    if (!this.creep.pos.isNearTo(this.targetPosition)) {
      return false
    }

    const terrain = game.rooms["sim"].getTerrainAt(this.targetPosition)
    if (terrain === false || terrain >= TERRAIN_WALL) {
      return false
    }

    const blockingCreep = this.getCreepInTargetSpot()
    if (blockingCreep) {
      // If this is true we've looped back on ourselves and can resolve a small portion of our blockage.
      if (alreadyChecked.includes(blockingCreep.id)) {
        this.creep.pos = this.targetPosition
        this.creep.fatigue = TERRAIN_FATIGUE[terrain]
        return true

      }

      const blockingCreepIntentId = this.getMoveIntentForCreep(intentQueue, blockingCreep)
      const blockingCreepIntent = intentQueue[blockingCreepIntentId]


      if (!blockingCreepIntent) {
        return false
      }

      // Simple swap- both creeps want to switch places so we let them
      if (this.creep.pos.isEqualTo(blockingCreepIntent.targetPosition)) {
        // Delete intent and manage here
        delete intentQueue[blockingCreepIntentId]

        // Move blocking creep into this location
        const thisTerrain = game.rooms["sim"].getTerrainAt(this.creep.pos)
        blockingCreep.pos = this.creep.pos
        blockingCreep.fatigue = TERRAIN_FATIGUE[thisTerrain]

        // Move this creep to current location
        this.creep.pos = this.targetPosition
        this.creep.fatigue = TERRAIN_FATIGUE[terrain]
        return true
      }

      // See if the blocking creep can resolve its action and free up the space.
      if (blockingCreepIntent.resolve(game, intentQueue, alreadyChecked)) {
        delete intentQueue[blockingCreepIntentId]

        // Still blocked
        if(this.getCreepInTargetSpot()) {
          return false
        }
        // Move this creep to current location
        this.creep.pos = this.targetPosition
        this.creep.fatigue = TERRAIN_FATIGUE[terrain]
        return true
      }


      return false
    }


    this.creep.fatigue = TERRAIN_FATIGUE[terrain]
    this.creep.pos = this.targetPosition
    return true
  }

  getCreepInTargetSpot() {
    const creeps = this.targetPosition.lookFor(LOOK_CREEPS)
    if (creeps.length > 0) {
      return creeps[0]
    }
    return false
  }

  getMoveIntentForCreep(intentQueue, creep) {
    for (const intent of Object.values(intentQueue)) {
      if (intent.type !== "move") {
        continue
      }
      if (intent.creep.id === creep.id) {
        return intent.id
      }
    }
    return false
  }

}


class Room {
  constructor(game, columns, rows) {
    this.columns = columns
    this.rows = rows
    this.grid = this.generateTerrain()
    this.gridCost = this.getCostMatrix()
    this.name = "sim"
    this.game = game
  }

  getRandomWalkablePosition() {
    while (true) {
      const pos = this.getRandomPosition()
      if (this.grid[pos.x][pos.y] < TERRAIN_WALL) {
        return pos
      }
    }
  }

  getRandomPosition() {
    return this.getPositionAt(
      Math.floor(Math.random() * (this.columns - 1)),
      Math.floor(Math.random() * (this.rows - 1))
    )
  }

  getTerrainAt(position) {
    return this.grid[position.x][position.y]
  }

  getTerrain() {
    return RoomTerrain(this.grid)
  }

  getPositionAt(x, y) {
    return new RoomPosition(this.game, this.name, x, y)
  }

  generateTerrain() {
    const grid = []

    // First pass creates mountains
    noise.seed(Math.random());
    for (var x = 0; x < this.columns; x++) {
      for (var y = 0; y < this.rows; y++) {
        if (!grid[x]) {
          grid[x] = []
        }
        const level = (noise.simplex2(x / 11, y / 11)+1)/2
        if (level < 0.20) {
          grid[x][y] = TERRAIN_WATER
        } else if (level < 0.68) {
          grid[x][y] = TERRAIN_PLAIN
        } else {
          grid[x][y] = TERRAIN_WALL
        }
      }
    }

    // Second pass adds swamps
    noise.seed(Math.random());
    for (var x = 0; x < this.columns; x++) {
      for (var y = 0; y < this.rows; y++) {
        if (grid[x][y] >= TERRAIN_WALL) {
          continue
        }
        const level = noise.simplex2(x / 9, y / 9)
        if (level < -0.45) {
          grid[x][y] = TERRAIN_SWAMP
        }
      }
    }

    return grid
  }

  findPath(fromPos, toPos, opts = {}) {
    const pathfinder = new astar(this.columns, this.rows)
	  const path = pathfinder.search(this.gridCost, fromPos, toPos, { heuristic: (pos0, pos1) => {
      const d1 = Math.abs(pos1.x - pos0.x);
      const d2 = Math.abs(pos1.y - pos0.y);
      return Math.max(d1, d2) * 1.2
    } })
    return path
  }

  getCostMatrix() {
    const costMatrix = []
    for (var x = 0; x < this.columns; x++) {
      for (var y = 0; y < this.rows; y++) {
        if (!costMatrix[x]) {
          costMatrix[x] = []
        }
        if (this.grid[x][y] >= TERRAIN_WALL) {
          costMatrix[x][y] = 0
        } else {
          costMatrix[x][y] = TERRAIN_FATIGUE[this.grid[x][y]]
        }
      }
    }
    return costMatrix
  }

  consoleLogCosts() {
    for (let y = 0; y < this.rows; y++) {
      let row = ''
      for (let x = 0; x < this.columns; x++) {
        row += this.gridCost[x][y]
      }
      console.log(row)
    }
  }

  find(type) {
    if (!this.findCache) {
      this.findCache = {}
      for (const gameObject of this.getAllRoomObjects()) {
        if (gameObject.pos.room !== this.name) {
          continue
        }
        const type = gameObject.getType()
        if (!this.findCache[type]) {
          this.findCache[type] = []
        }
        this.findCache[type].push(gameObject)
      }
    }
    if (!this.findCache[type]) {
      return []
    }
    return this.findCache[type]
  }

  getAllRoomObjects() {
    if (!this.roomObjectCache) {
      this.roomObjectCache = []
      for (const gameObject of Object.values(this.game.gameObjects)) {
        if (gameObject.pos.room !== this.name) {
          continue
        }
        this.roomObjectCache.push(gameObject)
      }
    }
    return this.roomObjectCache
  }

  upkeep() {
    delete this.findCache
    delete this.roomObjectCache
  }
}


class RoomTerrain {
  constructor(grid) {
    this.grid = grid
  }

  get (x, y) {
    return this.grid[x][y]
  }
}


class RoomPosition {
  constructor(game, room, x, y) {
    this.game = game
    this.room = room
    this.x = x
    this.y = y
  }

  getNeighbor(direction) {
    let x = this.x
    let y = this.y

    if ([TOP_LEFT, TOP, TOP_RIGHT].includes(direction)) {
      y--
    }

    if ([BOTTOM_LEFT, BOTTOM, BOTTOM_RIGHT].includes(direction)) {
      y++
    }

    if ([TOP_LEFT, LEFT, BOTTOM_LEFT].includes(direction)) {
      x--
    }

    if ([TOP_RIGHT, RIGHT, BOTTOM_RIGHT].includes(direction)) {
      x++
    }
    const columns = this.game.rooms[this.room].columns
    if (x > (columns-1) || x < 0) {
      return false
    }

    const rows = this.game.rooms[this.room].rows
    if (y > (rows-1) || y < 0) {
      return false
    }

    return new RoomPosition(this.game, this.room, x, y)
  }

  getRangeTo(target) {
    const pos = this.normalizeTarget(target)
    return Math.max(Math.abs(this.x-pos.x), Math.abs(this.y-pos.y))
  }

  findClosestByRange(type, opts = {}) {
    const items = this.game.rooms[this.room].find(type)
    let currentClosestDistance = Infinity
    let currentClosest = false
    for (const item of items) {
      const thisDistance = this.getRangeTo(item)
      if (thisDistance < currentClosestDistance) {
        currentClosestDistance = thisDistance
        currentClosest = item
      }
    }
    return currentClosest
  }

  findInRange(type, range, opts = {}) {
    const items = this.game.rooms[this.room].find(type)
    const returnItems = []
    for (const item of items) {
      if (this.getRangeTo(item) <= range) {
        returnItems.push(item)
      }
    }
    return returnItems
  }

  findPathTo(target, opts = {}) {
    const pos = this.normalizeTarget(target)
    return this.game.rooms[this.room].findPath(this, target)
  }

  getDirectionTo(target) {
    const pos = this.normalizeTarget(target)

    if (this.x == pos.x) {
      if (this.y > pos.y) {
        return TOP
      }
      if (this.y == pos.y) {
        return 0
      }
      if (this.y < pos.y) {
        return BOTTOM
      }
    }

    if (this.x < pos.x) {
      if (this.y > pos.y) {
        return TOP_RIGHT
      }
      if (this.y == pos.y) {
        return RIGHT
      }
      if (this.y < pos.y) {
        return BOTTOM_RIGHT
      }
    }

    if (this.x >= pos.x) {
      if (this.y > pos.y) {
        return TOP_LEFT
      }
      if (this.y == pos.y) {
        return LEFT
      }
      if (this.y < pos.y) {
        return BOTTOM_LEFT
      }
    }
  }

  inRangeTo(target, range) {
    const pos = this.normalizeTarget(target)
    return this.getRangeTo(pos) <= range
  }

  isEqualTo(target) {
    const pos = this.normalizeTarget(target)
    return this.room === pos.room && this.x === pos.x && this.y === pos.y
  }

  isNearTo(target) {
    const pos = this.normalizeTarget(target)
    return this.getRangeTo(pos) <= 1
  }

  look() {
    const roomObjects = this.game.rooms[this.room].getRoomObjects()
    const objects = []
    for (const object of roomObjects) {
      if (!this.isEqualTo(object.pos)) {
        continue
      }
      const tempObject = {"type": object.type}
      tempObject[object.type] = object
      objects.push(tempObject)
    }
    return objects
  }

  lookFor(type) {
    return this.findInRange(type, 0)
  }

  normalizeTarget(target) {
    if (target.pos) {
      return target.pos
    }
    return target
  }

}


class GameObject {

  constructor(game, pos) {
    this.game = game
    this.pos = pos
    this.room = game.rooms[pos.room]
    this.id = uuid()
    this.color = 'red'
    this.type = 'base'
    this.memory = {}
  }

  getPosition() {
    return this.pos
  }

  getColor() {
    return this.color
  }

  getType() {
    return this.type
  }

  upkeep() {
    // Internal actions that occur each tick
  }

}


const LOOK_CREEPS = "creep"
const FIND_CREEPS = LOOK_CREEPS
class Creep extends GameObject {
  constructor(game, pos) {
    super(game, pos)
    this.color = 'purple'
    this.type = LOOK_CREEPS
    this.fatigue = 0
  }

  upkeep () {
    if (this.fatigue > 0) {
      this.fatigue--
    }
  }

  move (direction) {
    const newPos = this.pos.getNeighbor(direction)
    if (!newPos) {
      return false
    }
    this.game.registerIntent(new MoveIntent(this, newPos))
  }

  moveByPath (path) {
    let nextPiece = false
    for (const piece of path) {
      if (nextPiece) {
        return this.move(piece.direction)
      }
      if (this.pos.x === piece.x && this.pos.y === piece.y) {
        nextPiece = true
      }
    }

    if (path.length > 0 && this.pos.getRangeTo(path[0]) === 1) {
      return this.move(path[0].direction)
    }

    return false
  }

  moveTo (pos) {
    if (this.memory._moveTo) {
      const moveToData = this.memory._moveTo
      if (pos.isEqualTo(moveToData.pos)) {
        return this.moveByPath(moveToData.path)
      }
    }
    const path = this.room.findPath(this.pos, pos)
    this.memory._moveTo = {
      "pos": pos,
      "path": path
    }
    return this.moveByPath(path)
  }

  suicide ( ) {

  }
}
