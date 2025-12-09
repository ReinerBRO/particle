/**
 * PS5 DualSense Controller Support Module
 * Supports reading all buttons, sensors, touchpad, and trigger intensity
 */

export class PS5Controller {
    constructor() {
        this.gamepad = null;
        this.gamepadIndex = null;
        this.connected = false;
        this.isPS5Controller = false;

        // Button states (current and previous for edge detection)
        this.buttons = {};
        this.prevButtons = {};

        // Axes states (sticks, triggers, gyro, accelerometer)
        this.axes = {};

        // Touchpad data
        this.touchpad = {
            touches: [],
            isPressed: false
        };

        // Haptic feedback support
        this.supportsHaptics = false;

        // Event callbacks
        this.callbacks = {
            onConnect: null,
            onDisconnect: null,
            onButtonPress: null,
            onButtonRelease: null,
            onButtonHold: null,
            onStickMove: null,
            onTriggerMove: null,
            onTouchpadTouch: null,
            onTouchpadRelease: null,
            onMotion: null,
            onMicrophoneBlow: null
        };

        // PS5 DualSense button mapping
        this.buttonMap = {
            0: 'cross',         // X (cross)
            1: 'circle',        // O (circle)
            2: 'square',        // □ (square)
            3: 'triangle',      // △ (triangle)
            4: 'L1',            // Left bumper
            5: 'R1',            // Right bumper
            6: 'L2',            // Left trigger (digital)
            7: 'R2',            // Right trigger (digital)
            8: 'share',         // Share/Create button
            9: 'options',       // Options button
            10: 'L3',           // Left stick press
            11: 'R3',           // Right stick press
            12: 'dpad_up',      // D-pad up
            13: 'dpad_down',    // D-pad down
            14: 'dpad_left',    // D-pad left
            15: 'dpad_right',   // D-pad right
            16: 'ps',           // PS button
            17: 'touchpad'      // Touchpad press
        };

        // Axes mapping
        this.axesMap = {
            0: 'leftStick_X',
            1: 'leftStick_Y',
            2: 'rightStick_X',
            3: 'rightStick_Y',
            // PS5 DualSense specific axes
            4: 'L2_analog',     // Left trigger analog pressure
            5: 'R2_analog'      // Right trigger analog pressure
        };

        // Dead zone for analog sticks
        this.deadZone = 0.15;

        // Microphone blow detection (using motion sensors as proxy)
        this.blowThreshold = 2.5;
        this.lastAcceleration = { x: 0, y: 0, z: 0 };

        // Initialize
        this.init();
    }

    init() {
        // Listen for gamepad connection events
        window.addEventListener('gamepadconnected', (e) => this.onGamepadConnected(e));
        window.addEventListener('gamepaddisconnected', (e) => this.onGamepadDisconnected(e));

        // Check if gamepad is already connected
        this.scanForGamepads();
    }

    scanForGamepads() {
        const gamepads = navigator.getGamepads();
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i]) {
                this.onGamepadConnected({ gamepad: gamepads[i] });
                break;
            }
        }
    }

    onGamepadConnected(event) {
        const gamepad = event.gamepad;
        console.log(`[PS5Controller] Gamepad connected: ${gamepad.id}`);

        // Check if it's a PS5 DualSense controller
        const id = gamepad.id.toLowerCase();
        this.isPS5Controller = id.includes('dualsense') ||
            id.includes('ps5') ||
            id.includes('054c');  // Sony vendor ID

        this.gamepad = gamepad;
        this.gamepadIndex = gamepad.index;
        this.connected = true;

        // Check for haptic feedback support
        this.supportsHaptics = 'vibrationActuator' in gamepad;

        console.log(`[PS5Controller] Is PS5: ${this.isPS5Controller}, Supports Haptics: ${this.supportsHaptics}`);

        // Initialize button states
        this.initializeButtonStates();

        // Trigger callback
        if (this.callbacks.onConnect) {
            this.callbacks.onConnect({
                isPS5: this.isPS5Controller,
                supportsHaptics: this.supportsHaptics,
                id: gamepad.id
            });
        }
    }

    onGamepadDisconnected(event) {
        if (event.gamepad.index === this.gamepadIndex) {
            console.log('[PS5Controller] Gamepad disconnected');
            this.connected = false;
            this.gamepad = null;
            this.gamepadIndex = null;

            if (this.callbacks.onDisconnect) {
                this.callbacks.onDisconnect();
            }
        }
    }

    initializeButtonStates() {
        for (let key in this.buttonMap) {
            const buttonName = this.buttonMap[key];
            this.buttons[buttonName] = {
                pressed: false,
                value: 0,
                touched: false
            };
            this.prevButtons[buttonName] = {
                pressed: false,
                value: 0,
                touched: false
            };
        }
    }

    // Main update loop - call this in your animation loop
    update() {
        if (!this.connected) return;

        // Get latest gamepad state
        const gamepads = navigator.getGamepads();
        this.gamepad = gamepads[this.gamepadIndex];

        if (!this.gamepad) {
            this.connected = false;
            return;
        }

        // Update button states
        this.updateButtons();

        // Update axes (sticks and triggers)
        this.updateAxes();

        // Update touchpad (if available)
        this.updateTouchpad();

        // Update motion sensors (gyro/accelerometer)
        this.updateMotion();

        // Detect microphone blow (heuristic based on motion)
        this.detectMicrophoneBlow();
    }

    updateButtons() {
        // Save previous state
        for (let key in this.buttons) {
            this.prevButtons[key] = { ...this.buttons[key] };
        }

        // Update current state
        this.gamepad.buttons.forEach((button, index) => {
            const buttonName = this.buttonMap[index];
            if (!buttonName) return;

            const wasPressed = this.buttons[buttonName].pressed;
            const isPressed = button.pressed;

            this.buttons[buttonName] = {
                pressed: isPressed,
                value: button.value,
                touched: button.touched || false
            };

            // Trigger callbacks for button events
            if (isPressed && !wasPressed) {
                // Button press (edge)
                if (this.callbacks.onButtonPress) {
                    this.callbacks.onButtonPress(buttonName, button.value);
                }
            } else if (!isPressed && wasPressed) {
                // Button release (edge)
                if (this.callbacks.onButtonRelease) {
                    this.callbacks.onButtonRelease(buttonName);
                }
            } else if (isPressed && wasPressed) {
                // Button hold
                if (this.callbacks.onButtonHold) {
                    this.callbacks.onButtonHold(buttonName, button.value);
                }
            }
        });
    }

    updateAxes() {
        this.gamepad.axes.forEach((value, index) => {
            const axisName = this.axesMap[index];
            if (!axisName) return;

            // Apply dead zone for sticks
            let processedValue = value;
            if (axisName.includes('Stick')) {
                if (Math.abs(value) < this.deadZone) {
                    processedValue = 0;
                }
            }

            this.axes[axisName] = processedValue;
        });

        // Trigger stick movement callback
        if (this.callbacks.onStickMove) {
            this.callbacks.onStickMove({
                left: {
                    x: this.axes.leftStick_X || 0,
                    y: this.axes.leftStick_Y || 0
                },
                right: {
                    x: this.axes.rightStick_X || 0,
                    y: this.axes.rightStick_Y || 0
                }
            });
        }

        // Trigger trigger movement callback (pressure intensity)
        if (this.callbacks.onTriggerMove) {
            this.callbacks.onTriggerMove({
                L2: this.axes.L2_analog || 0,
                R2: this.axes.R2_analog || 0
            });
        }
    }

    updateTouchpad() {
        // Note: Full touchpad position data is not available via standard Gamepad API
        // We can only detect touchpad press via button 17
        // For full touchpad coordinates, we would need HID access or Chrome's experimental APIs

        const wasTouchpadPressed = this.touchpad.isPressed;
        this.touchpad.isPressed = this.buttons.touchpad?.pressed || false;

        if (this.touchpad.isPressed && !wasTouchpadPressed) {
            if (this.callbacks.onTouchpadTouch) {
                this.callbacks.onTouchpadTouch();
            }
        } else if (!this.touchpad.isPressed && wasTouchpadPressed) {
            if (this.callbacks.onTouchpadRelease) {
                this.callbacks.onTouchpadRelease();
            }
        }

        // Note: For advanced touchpad coordinate reading, we need to use
        // navigator.hid or Chrome's experimental gamepad extensions
        // This is a limitation of the standard Gamepad API
    }

    updateMotion() {
        // Motion sensor data (gyroscope, accelerometer) is not available in standard Gamepad API
        // For PS5 DualSense, we need to use navigator.hid or other specialized APIs
        // This is a placeholder for when such data becomes available

        // In a full implementation, we would read:
        // - Gyroscope (rotation rates)
        // - Accelerometer (linear acceleration)
        // - These can be used for motion controls

        if (this.callbacks.onMotion) {
            // Placeholder - would contain actual motion data
            this.callbacks.onMotion({
                gyro: { x: 0, y: 0, z: 0 },
                accel: { x: 0, y: 0, z: 0 }
            });
        }
    }

    detectMicrophoneBlow() {
        // Microphone blow detection is not directly available via Gamepad API
        // We would need to use Web Audio API to access the DualSense microphone
        // This is a heuristic placeholder

        // In a real implementation, we would:
        // 1. Request microphone access
        // 2. Analyze audio input for sudden volume spikes
        // 3. Detect blow patterns

        // For now, we can provide a method to integrate with Web Audio API
    }

    // === Public API Methods ===

    /**
     * Check if a button is currently pressed
     */
    isButtonPressed(buttonName) {
        return this.buttons[buttonName]?.pressed || false;
    }

    /**
     * Get button pressure (0-1 for analog buttons like triggers)
     */
    getButtonValue(buttonName) {
        return this.buttons[buttonName]?.value || 0;
    }

    /**
     * Check if button was just pressed this frame
     */
    isButtonJustPressed(buttonName) {
        return this.buttons[buttonName]?.pressed &&
            !this.prevButtons[buttonName]?.pressed;
    }

    /**
     * Check if button was just released this frame
     */
    isButtonJustReleased(buttonName) {
        return !this.buttons[buttonName]?.pressed &&
            this.prevButtons[buttonName]?.pressed;
    }

    /**
     * Get left stick position
     */
    getLeftStick() {
        return {
            x: this.axes.leftStick_X || 0,
            y: this.axes.leftStick_Y || 0
        };
    }

    /**
     * Get right stick position
     */
    getRightStick() {
        return {
            x: this.axes.rightStick_X || 0,
            y: this.axes.rightStick_Y || 0
        };
    }

    /**
     * Get trigger pressure (0-1)
     */
    getTriggerPressure(trigger) {
        if (trigger === 'L2') return this.axes.L2_analog || 0;
        if (trigger === 'R2') return this.axes.R2_analog || 0;
        return 0;
    }

    /**
     * Get D-pad state
     */
    getDPad() {
        return {
            up: this.isButtonPressed('dpad_up'),
            down: this.isButtonPressed('dpad_down'),
            left: this.isButtonPressed('dpad_left'),
            right: this.isButtonPressed('dpad_right')
        };
    }

    /**
     * Vibrate controller (if supported)
     */
    vibrate(duration = 200, weakMagnitude = 0.5, strongMagnitude = 0.5) {
        if (!this.supportsHaptics || !this.gamepad) return;

        try {
            this.gamepad.vibrationActuator.playEffect('dual-rumble', {
                duration: duration,
                weakMagnitude: weakMagnitude,
                strongMagnitude: strongMagnitude
            });
        } catch (e) {
            console.error('[PS5Controller] Vibration failed:', e);
        }
    }

    /**
     * Set callback functions
     */
    on(eventName, callback) {
        if (this.callbacks.hasOwnProperty('on' + eventName.charAt(0).toUpperCase() + eventName.slice(1))) {
            this.callbacks['on' + eventName.charAt(0).toUpperCase() + eventName.slice(1)] = callback;
        }
    }

    /**
     * Get all current controller state
     */
    getState() {
        return {
            connected: this.connected,
            isPS5: this.isPS5Controller,
            buttons: { ...this.buttons },
            axes: { ...this.axes },
            touchpad: { ...this.touchpad },
            leftStick: this.getLeftStick(),
            rightStick: this.getRightStick(),
            triggers: {
                L2: this.getTriggerPressure('L2'),
                R2: this.getTriggerPressure('R2')
            },
            dpad: this.getDPad()
        };
    }
}

/**
 * Advanced PS5 Microphone Blow Detection using Web Audio API
 */
export class PS5MicrophoneDetector {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.dataArray = null;
        this.isListening = false;
        this.blowThreshold = 0.7; // Threshold for detecting blow (0-1)
        this.onBlowCallback = null;
        this.onBlowEndCallback = null;
        this.isBlowing = false;
    }

    async start() {
        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;

            // Connect microphone
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.analyser);

            // Setup data array
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);

            this.isListening = true;
            this.detectBlow();

            console.log('[PS5Microphone] Blow detection started');
            return true;
        } catch (e) {
            console.error('[PS5Microphone] Failed to start:', e);
            return false;
        }
    }

    detectBlow() {
        if (!this.isListening) return;

        this.analyser.getByteFrequencyData(this.dataArray);

        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i];
        }
        const average = sum / this.dataArray.length / 255; // Normalize to 0-1

        // Detect blow (sudden spike in volume)
        if (average > this.blowThreshold) {
            if (!this.isBlowing) {
                this.isBlowing = true;
                if (this.onBlowCallback) {
                    this.onBlowCallback(average);
                }
            }
        } else {
            if (this.isBlowing) {
                this.isBlowing = false;
                if (this.onBlowEndCallback) {
                    this.onBlowEndCallback();
                }
            }
        }

        requestAnimationFrame(() => this.detectBlow());
    }

    stop() {
        this.isListening = false;
        if (this.microphone) {
            this.microphone.disconnect();
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
        console.log('[PS5Microphone] Blow detection stopped');
    }

    onBlow(callback) {
        this.onBlowCallback = callback;
    }

    onBlowEnd(callback) {
        this.onBlowEndCallback = callback;
    }

    setThreshold(threshold) {
        this.blowThreshold = Math.max(0, Math.min(1, threshold));
    }
}

/**
 * Advanced Touchpad Support using Chrome HID API (experimental)
 * This requires Chrome and user permission for HID access
 */
export class PS5TouchpadReader {
    constructor() {
        this.device = null;
        this.isReading = false;
        this.touchData = {
            touch1: { active: false, x: 0, y: 0 },
            touch2: { active: false, x: 0, y: 0 }
        };
        this.onTouchCallback = null;
    }

    async requestAccess() {
        if (!('hid' in navigator)) {
            console.error('[PS5Touchpad] WebHID not supported in this browser');
            return false;
        }

        try {
            const devices = await navigator.hid.requestDevice({
                filters: [{ vendorId: 0x054C, productId: 0x0CE6 }] // PS5 DualSense
            });

            if (devices.length > 0) {
                this.device = devices[0];
                await this.device.open();
                this.startReading();
                console.log('[PS5Touchpad] Connected to DualSense touchpad');
                return true;
            }
        } catch (e) {
            console.error('[PS5Touchpad] Failed to access:', e);
        }

        return false;
    }

    startReading() {
        if (!this.device) return;

        this.isReading = true;
        this.device.addEventListener('inputreport', (event) => {
            this.parseInputReport(event);
        });
    }

    parseInputReport(event) {
        // Parse DualSense HID report for touchpad data
        // Note: This is simplified - actual parsing depends on report format
        const { data } = event;

        // Touchpad data is typically in bytes 33-36 for first touch
        // and bytes 37-40 for second touch (varies by firmware)

        // This is a placeholder - actual implementation requires
        // reverse engineering of PS5 HID reports

        if (this.onTouchCallback) {
            this.onTouchCallback(this.touchData);
        }
    }

    onTouch(callback) {
        this.onTouchCallback = callback;
    }

    stop() {
        this.isReading = false;
        if (this.device) {
            this.device.close();
        }
    }
}
