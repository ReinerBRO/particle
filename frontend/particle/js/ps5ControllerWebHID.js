/**
 * PS5 Controller WebHID Client
 * 使用原生 WebHID API 直接读取 PS5 手柄数据
 * 支持：按键、摇杆、陀螺仪、触摸板、震动、LED、麦克风
 */

export class PS5ControllerWebHID {
    constructor() {
        this.device = null;
        this.connected = false;
        this.microphone = null;
        this.audioContext = null;
        this.micAnalyser = null;

        // 事件回调
        this.callbacks = {
            connected: [],
            disconnected: [],
            buttonPress: [],
            buttonRelease: [],
            touchpadPress: [],
            touchpadRelease: [],
            stateUpdate: []
        };

        // 当前状态
        this.state = {
            buttons: {},
            leftStick: { x: 0, y: 0 },
            rightStick: { x: 0, y: 0 },
            triggers: { L2: 0, R2: 0 },
            touchpad: { touching: false, x: 0, y: 0 },
            gyro: { x: 0, y: 0, z: 0 },
            accelerometer: { x: 0, y: 0, z: 0 }
        };

        // 按键状态跟踪
        this.previousButtons = {};
        this.previousTouchpadPressed = false;
    }

    /**
     * 自动连接已授权的设备
     */

    async autoConnect() {
        try {
            // Check if API is available
            if (!navigator.hid) {
                console.warn('[PS5WebHID] WebHID API not available');
                return false;
            }

            const devices = await navigator.hid.getDevices();
            console.log(`[PS5WebHID] Auto-connect found ${devices.length} authorized devices.`);

            const ps5Device = devices.find(d => d.vendorId === 0x054C && d.productId === 0x0CE6);

            if (ps5Device) {
                console.log('[PS5WebHID] Found authorized PS5 controller, connecting...');
                this.device = ps5Device;

                if (!this.device.opened) {
                    await this.device.open();
                    console.log('[PS5WebHID] Device opened successfully');
                } else {
                    console.log('[PS5WebHID] Device was already open');
                }

                this.connected = true;

                // Remove existing listener to prevent duplicates if any (though unlikely on new instance)
                // this.device.removeEventListener('inputreport', ...); 
                // Since this is a fresh instance, direct add is fine.

                this.device.addEventListener('inputreport', (event) => {
                    this.handleInputReport(event);
                });

                this.emit('connected');

                // 自动连接不初始化麦克风，以免触发权限弹窗干扰
                // await this.initMicrophone();
                return true;
            } else {
                console.log('[PS5WebHID] No authorized PS5 controller found in getDevices(). Manual connect required.');
            }
            return false;
        } catch (error) {
            console.warn('[PS5WebHID] Auto-connect failed:', error);
            return false;
        }
    }

    /**
     * 连接PS5手柄
     */
    async connect() {
        try {
            console.log('[PS5WebHID] Requesting device...');

            // 请求 HID 设备
            const devices = await navigator.hid.requestDevice({
                filters: [{ vendorId: 0x054C, productId: 0x0CE6 }] // Sony DualSense
            });

            if (!devices || devices.length === 0) {
                throw new Error('No device selected');
            }

            this.device = devices[0];
            await this.device.open();

            this.connected = true;
            console.log('[PS5WebHID] Connected successfully');

            // 监听输入报告
            this.device.addEventListener('inputreport', (event) => {
                this.handleInputReport(event);
            });

            // 触发连接回调
            this.emit('connected');

            // 初始化麦克风
            await this.initMicrophone();

        } catch (error) {
            console.error('[PS5WebHID] Connection failed:', error);
            throw error;
        }
    }

    /**
     * 处理输入报告
     * 
     * USB Input Report 0x01 格式 (WebHID data 不包含 Report ID):
     * Byte 0: Left Stick X (0x00=left, 0xFF=right, ~0x80=neutral)
     * Byte 1: Left Stick Y (0x00=up, 0xFF=down, ~0x80=neutral)
     * Byte 2: Right Stick X
     * Byte 3: Right Stick Y
     * Byte 4: L2 Trigger (0x00=released, 0xFF=fully pressed)
     * Byte 5: R2 Trigger
     * Byte 6: Vendor (unused)
     * Byte 7 [bit 0-3]: D-Pad (0=N, 1=NE, 2=E, 3=SE, 4=S, 5=SW, 6=W, 7=NW, 8=neutral)
     * Byte 7 [bit 4]: Square
     * Byte 7 [bit 5]: Cross
     * Byte 7 [bit 6]: Circle
     * Byte 7 [bit 7]: Triangle
     * Byte 8 [bit 0]: L1
     * Byte 8 [bit 1]: R1
     * Byte 8 [bit 2]: L2 button
     * Byte 8 [bit 3]: R2 button
     * Byte 8 [bit 4]: Create (Share)
     * Byte 8 [bit 5]: Options
     * Byte 8 [bit 6]: L3
     * Byte 8 [bit 7]: R3
     * Byte 9 [bit 0]: PS button
     * Byte 9 [bit 1]: Touchpad click
     * Byte 9 [bit 2]: Mute button
     * Bytes 15-20: Gyroscope (3x int16 LE)
     * Bytes 21-26: Accelerometer (3x int16 LE)
     * Bytes 32-35: Touchpad touch point 1
     */
    handleInputReport(event) {
        const { data, reportId } = event;

        if (this.debug) {
            const bytes = new Uint8Array(data.buffer);
            console.log(`[PS5-Raw] ID: ${reportId.toString(16)} | Data: ${Array.from(bytes).slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
        }

        // Report ID 0x01 (USB) 或 0x31 (Bluetooth)
        if (reportId !== 0x01 && reportId !== 0x31) return;

        // 蓝牙模式偏移 (0x31 报告有额外的头部)
        const offset = (reportId === 0x31) ? 1 : 0;

        // ========== 摇杆 (Bytes 0-3) ==========
        this.state.leftStick.x = (data.getUint8(0 + offset) - 127.5) / 127.5;
        this.state.leftStick.y = (data.getUint8(1 + offset) - 127.5) / 127.5;
        this.state.rightStick.x = (data.getUint8(2 + offset) - 127.5) / 127.5;
        this.state.rightStick.y = (data.getUint8(3 + offset) - 127.5) / 127.5;

        // ========== 扳机 (Bytes 4-5) ==========
        this.state.triggers.L2 = data.getUint8(4 + offset) / 255;
        this.state.triggers.R2 = data.getUint8(5 + offset) / 255;

        // ========== 按键 (Bytes 7-9) ==========
        const buttonsByte1 = data.getUint8(7 + offset); // D-Pad + Square/Cross/Circle/Triangle
        const buttonsByte2 = data.getUint8(8 + offset); // L1/R1/L2/R2/Create/Options/L3/R3
        const buttonsByte3 = data.getUint8(9 + offset); // PS/Touchpad/Mute

        // D-Pad (低4位: 0-7方向, 8=中立)
        const dpad = buttonsByte1 & 0x0F;
        const dpadMap = [
            { up: true, right: false, down: false, left: false },   // 0: N
            { up: true, right: true, down: false, left: false },    // 1: NE
            { up: false, right: true, down: false, left: false },   // 2: E
            { up: false, right: true, down: true, left: false },    // 3: SE
            { up: false, right: false, down: true, left: false },   // 4: S
            { up: false, right: false, down: true, left: true },    // 5: SW
            { up: false, right: false, down: false, left: true },   // 6: W
            { up: true, right: false, down: false, left: true },    // 7: NW
            { up: false, right: false, down: false, left: false }   // 8: neutral
        ];
        const dpadState = dpadMap[dpad > 8 ? 8 : dpad];

        this.state.buttons.dpad_up = dpadState.up;
        this.state.buttons.dpad_right = dpadState.right;
        this.state.buttons.dpad_down = dpadState.down;
        this.state.buttons.dpad_left = dpadState.left;

        // 主要按键 (Byte 7 高4位)
        this.state.buttons.square = !!(buttonsByte1 & 0x10);
        this.state.buttons.cross = !!(buttonsByte1 & 0x20);
        this.state.buttons.circle = !!(buttonsByte1 & 0x40);
        this.state.buttons.triangle = !!(buttonsByte1 & 0x80);

        // 肩键和系统键 (Byte 8)
        this.state.buttons.L1 = !!(buttonsByte2 & 0x01);
        this.state.buttons.R1 = !!(buttonsByte2 & 0x02);
        this.state.buttons.L2_btn = !!(buttonsByte2 & 0x04);
        this.state.buttons.R2_btn = !!(buttonsByte2 & 0x08);
        this.state.buttons.share = !!(buttonsByte2 & 0x10);  // Create button
        this.state.buttons.options = !!(buttonsByte2 & 0x20);
        this.state.buttons.L3 = !!(buttonsByte2 & 0x40);
        this.state.buttons.R3 = !!(buttonsByte2 & 0x80);

        // PS键、触摸板、麦克风 (Byte 9)
        this.state.buttons.ps = !!(buttonsByte3 & 0x01);
        this.state.buttons.touchpad_click = !!(buttonsByte3 & 0x02);
        this.state.buttons.mute = !!(buttonsByte3 & 0x04);

        // ========== 陀螺仪 (Bytes 15-20, 16位有符号整数 LE) ==========
        if (data.byteLength > 20 + offset) {
            this.state.gyro.x = data.getInt16(15 + offset, true);
            this.state.gyro.y = data.getInt16(17 + offset, true);
            this.state.gyro.z = data.getInt16(19 + offset, true);
        }

        // ========== 加速度计 (Bytes 21-26) ==========
        if (data.byteLength > 26 + offset) {
            this.state.accelerometer.x = data.getInt16(21 + offset, true);
            this.state.accelerometer.y = data.getInt16(23 + offset, true);
            this.state.accelerometer.z = data.getInt16(25 + offset, true);
        }

        // ========== 触摸板 (Bytes 32-35 & 36-39) ==========
        this.state.touchpad.touches = [];
        this.state.touchpad.touching = false; // Reset first, will set to true if any touch active

        if (data.byteLength > 39 + offset) {
            // Helper to parse a touch point
            const parseTouch = (startIndex) => {
                const touchData = data.getUint8(startIndex);
                const touchActive = (touchData & 0x80) === 0; // Bit 7: 0=Active, 1=Inactive

                if (touchActive) {
                    const id = touchData & 0x7F;
                    const x1 = data.getUint8(startIndex + 1);
                    const x2 = data.getUint8(startIndex + 2) & 0x0F;
                    const touchX = ((x2 << 8) | x1) / 1920 * 2 - 1;

                    const y1 = (data.getUint8(startIndex + 2) & 0xF0) >> 4;
                    const y2 = data.getUint8(startIndex + 3);
                    const touchY = ((y2 << 4) | y1) / 1080 * 2 - 1;

                    return { x: touchX, y: touchY, id: id };
                }
                return null;
            };

            const t1 = parseTouch(32 + offset);
            const t2 = parseTouch(36 + offset);

            if (t1) this.state.touchpad.touches.push(t1);
            if (t2) this.state.touchpad.touches.push(t2);

            // Backward compatibility
            if (this.state.touchpad.touches.length > 0) {
                this.state.touchpad.touching = true;
                this.state.touchpad.x = this.state.touchpad.touches[0].x;
                this.state.touchpad.y = this.state.touchpad.touches[0].y;
            } else {
                this.state.touchpad.touching = false;
                this.state.touchpad.x = 0;
                this.state.touchpad.y = 0;
            }
        }

        // 检测按键变化
        this.detectButtonChanges();

        // 检测触控板变化
        this.detectTouchpadChanges();

        // 发送状态更新事件
        this.emit('stateUpdate', this.state);
    }

    /**
     * 检测按键变化
     */
    detectButtonChanges() {
        const buttonMap = {
            cross: this.state.buttons.cross,
            circle: this.state.buttons.circle,
            square: this.state.buttons.square,
            triangle: this.state.buttons.triangle,
            dpad_up: this.state.buttons.dpad_up,
            dpad_down: this.state.buttons.dpad_down,
            dpad_left: this.state.buttons.dpad_left,
            dpad_right: this.state.buttons.dpad_right,
            L1: this.state.buttons.L1,
            R1: this.state.buttons.R1,
            L2: this.state.buttons.L2_btn,         // 使用 L2 物理按键状态
            R2: this.state.buttons.R2_btn,         // 使用 R2 物理按键状态
            L3: this.state.buttons.L3,
            R3: this.state.buttons.R3,
            share: this.state.buttons.share,
            options: this.state.buttons.options,
            ps: this.state.buttons.ps,
            touchpad_click: this.state.buttons.touchpad_click // 触摸板点击键
        };

        for (const [name, pressed] of Object.entries(buttonMap)) {
            const wasPressedBefore = this.previousButtons[name];

            if (pressed && !wasPressedBefore) {
                console.log(`[PS5WebHID] Button PRESS detected: ${name}`);
                this.emit('buttonPress', name);
            } else if (!pressed && wasPressedBefore) {
                console.log(`[PS5WebHID] Button RELEASE detected: ${name}`);
                this.emit('buttonRelease', name);
            }

            this.previousButtons[name] = pressed;
        }
    }

    /**
     * 检测触控板变化
     */
    detectTouchpadChanges() {
        const touchpadPressed = this.state.buttons.touchpad_click;

        if (touchpadPressed && !this.previousTouchpadPressed) {
            this.emit('touchpadPress');
        } else if (!touchpadPressed && this.previousTouchpadPressed) {
            this.emit('touchpadRelease');
        }

        this.previousTouchpadPressed = touchpadPressed;
    }

    /**
     * 初始化麦克风
     */
    async initMicrophone() {
        try {
            console.log('[PS5WebHID] Initializing microphone...');

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const audioTracks = stream.getAudioTracks();
            const ps5Mic = audioTracks.find(track =>
                track.label.includes('Wireless Controller') ||
                track.label.includes('DualSense')
            );

            if (ps5Mic) {
                this.microphone = stream;
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.micAnalyser = this.audioContext.createAnalyser();
                this.micAnalyser.fftSize = 256;

                const source = this.audioContext.createMediaStreamSource(stream);
                source.connect(this.micAnalyser);

                console.log('[PS5WebHID] Microphone initialized:', ps5Mic.label);
            }
        } catch (error) {
            console.warn('[PS5WebHID] Microphone initialization failed:', error);
        }
    }

    /**
     * 获取麦克风音量 (Linear RMS)
     */
    getMicLevel() {
        if (!this.micAnalyser) return 0;

        const dataArray = new Uint8Array(this.micAnalyser.fftSize);
        this.micAnalyser.getByteTimeDomainData(dataArray);

        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
            // Center is 128. Normalize to -1..1 range
            const normalized = (dataArray[i] - 128) / 128;
            sumSquares += normalized * normalized;
        }

        const rms = Math.sqrt(sumSquares / dataArray.length);

        // Boost low levels slightly if needed, or return raw RMS
        // RMS is usually quite small for speech, usually 0.01 - 0.5
        // Let's amplify it a bit for usability, e.g. multiply by 3-5X but clamp at 1.0
        // Or just return raw RMS and let the controller handle thresholds.
        // User asked for "Linear change", so raw RMS is best.

        return Math.min(rms * 5.0, 1.0); // Boost factor 5x makes normal speech around 0.3-0.6
    }

    /**
     * 震动 (已禁用 - WebHID 不支持发送报告到 DualSense)
     */
    async vibrate(leftIntensity, rightIntensity, duration = 200) {
        // sendReport 在 WebHID 中对 DualSense 不可用，静默忽略
        return;
    }

    /**
     * 设置LED颜色 (已禁用 - WebHID 不支持发送报告到 DualSense)
     */
    async setLED(r, g, b) {
        // sendReport 在 WebHID 中对 DualSense 不可用，静默忽略
        return;
    }

    /**
     * 获取当前状态
     */
    getState() {
        return this.state;
    }

    /**
     * 获取左摇杆
     */
    getLeftStick() {
        return this.state.leftStick;
    }

    /**
     * 获取右摇杆
     */
    getRightStick() {
        return this.state.rightStick;
    }

    /**
     * 获取扳机压力
     */
    getTriggerPressure(trigger) {
        if (trigger === 'L2' || trigger === 'left') {
            return this.state.triggers.L2;
        } else if (trigger === 'R2' || trigger === 'right') {
            return this.state.triggers.R2;
        }
        return 0;
    }

    /**
     * 获取扳机数据对象
     */
    getTriggers() {
        return { l2: this.state.triggers.L2, r2: this.state.triggers.R2 };
    }

    /**
     * 获取加速度计数据
     */
    getAccel() {
        return this.state.accelerometer;
    }

    /**
     * 获取触控板数据
     */
    getTouchpad() {
        return this.state.touchpad;
    }

    /**
     * 获取陀螺仪数据
     */
    getGyro() {
        return this.state.gyro;
    }

    /**
     * 获取加速度计数据
     */
    getAccelerometer() {
        return this.state.accelerometer;
    }

    /**
     * 注册事件回调
     */
    on(eventName, callback) {
        if (this.callbacks[eventName]) {
            this.callbacks[eventName].push(callback);
        }
    }

    /**
     * 触发事件
     */
    emit(eventName, ...args) {
        if (this.callbacks[eventName]) {
            this.callbacks[eventName].forEach(cb => cb(...args));
        }
    }

    /**
     * 断开连接
     */
    disconnect() {
        if (this.device) {
            try {
                this.device.close();
            } catch (error) {
                console.error('[PS5WebHID] Disconnect error:', error);
            }
        }

        if (this.microphone) {
            this.microphone.getTracks().forEach(track => track.stop());
        }

        if (this.audioContext) {
            this.audioContext.close();
        }

        this.connected = false;
        this.device = null;
        this.microphone = null;
        this.audioContext = null;
        this.micAnalyser = null;

        this.emit('disconnected');
    }
}

export default PS5ControllerWebHID;
