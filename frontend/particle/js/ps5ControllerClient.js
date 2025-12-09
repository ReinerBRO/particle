/**
 * PS5 Controller WebSocket Client
 * 连接到本地Python服务器，接收完整的手柄数据
 * 支持：触控板坐标、扳机压力、陀螺仪、加速度计、麦克风等
 */

export class PS5ControllerClient {
    constructor(serverUrl = 'ws://localhost:8765') {
        this.serverUrl = serverUrl;
        this.ws = null;
        this.connected = false;
        this.reconnectDelay = 2000;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;

        // 手柄状态
        this.state = {
            buttons: {},
            sticks: { left: {}, right: {} },
            triggers: {},
            touchpad: { touch1: {}, touch2: {} },
            gyro: {},
            accelerometer: {},
            battery: {}
        };

        // 事件回调
        this.callbacks = {
            onConnect: null,
            onDisconnect: null,
            onStateUpdate: null,
            onButtonPress: null,
            onButtonRelease: null,
            onStickMove: null,
            onTriggerMove: null,
            onTouchpadTouch: null,
            onTouchpadMove: null,
            onTouchpadRelease: null,
            onGyroMove: null,
            onAccelMove: null,
            onMicrophoneBlow: null,
            onBatteryChange: null
        };

        // 触控板状态追踪
        this.prevTouchpad = { touch1: { active: false }, touch2: { active: false } };
    }

    /**
     * 连接到服务器
     */
    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('[PS5] 已经连接到服务器');
            return;
        }

        console.log(`[PS5] 正在连接到服务器: ${this.serverUrl}`);

        try {
            this.ws = new WebSocket(this.serverUrl);

            this.ws.onopen = () => this.onOpen();
            this.ws.onmessage = (event) => this.onMessage(event);
            this.ws.onerror = (error) => this.onError(error);
            this.ws.onclose = () => this.onClose();
        } catch (error) {
            console.error('[PS5] 连接失败:', error);
            this.scheduleReconnect();
        }
    }

    onOpen() {
        console.log('[PS5] ✅ 已连接到手柄服务器');
        this.connected = true;
        this.reconnectAttempts = 0;

        if (this.callbacks.onConnect) {
            this.callbacks.onConnect();
        }
    }

    onMessage(event) {
        try {
            const data = JSON.parse(event.data);

            switch (data.type) {
                case 'connected':
                    console.log('[PS5] 服务器功能:', data.features);
                    break;

                case 'controller_state':
                    this.handleStateUpdate(data.state, data.events);
                    break;

                default:
                    console.log('[PS5] 未知消息类型:', data.type);
            }
        } catch (error) {
            console.error('[PS5] 解析消息失败:', error);
        }
    }

    handleStateUpdate(state, events) {
        // 更新状态
        this.state = state;

        // 触发状态更新回调
        if (this.callbacks.onStateUpdate) {
            this.callbacks.onStateUpdate(state);
        }

        // 处理事件
        if (events && events.length > 0) {
            events.forEach(event => {
                if (event.type === 'button_press' && this.callbacks.onButtonPress) {
                    this.callbacks.onButtonPress(event.button);
                } else if (event.type === 'button_release' && this.callbacks.onButtonRelease) {
                    this.callbacks.onButtonRelease(event.button);
                } else if (event.type === 'microphone_blow' && this.callbacks.onMicrophoneBlow) {
                    this.callbacks.onMicrophoneBlow(event.intensity);
                }
            });
        }

        // 摇杆移动
        if (this.callbacks.onStickMove) {
            this.callbacks.onStickMove({
                left: {
                    x: state.sticks.left.normalized_x,
                    y: state.sticks.left.normalized_y
                },
                right: {
                    x: state.sticks.right.normalized_x,
                    y: state.sticks.right.normalized_y
                }
            });
        }

        // 扳機移動
        if (this.callbacks.onTriggerMove) {
            this.callbacks.onTriggerMove({
                L2: state.triggers.L2_normalized,
                R2: state.triggers.R2_normalized,
                L2_raw: state.triggers.L2,
                R2_raw: state.triggers.R2
            });
        }

        // 触控板事件检测
        this.handleTouchpadEvents(state.touchpad);

        // 陀螺仪
        if (this.callbacks.onGyroMove) {
            this.callbacks.onGyroMove(state.gyro);
        }

        // 加速度计
        if (this.callbacks.onAccelMove) {
            this.callbacks.onAccelMove(state.accelerometer);
        }
    }

    handleTouchpadEvents(touchpad) {
        // Touch 1
        if (touchpad.touch1.active && !this.prevTouchpad.touch1.active) {
            // 触摸开始
            if (this.callbacks.onTouchpadTouch) {
                this.callbacks.onTouchpadTouch(1, touchpad.touch1.normalized_x, touchpad.touch1.normalized_y);
            }
        } else if (!touchpad.touch1.active && this.prevTouchpad.touch1.active) {
            // 触摸结束
            if (this.callbacks.onTouchpadRelease) {
                this.callbacks.onTouchpadRelease(1);
            }
        } else if (touchpad.touch1.active && this.prevTouchpad.touch1.active) {
            // 触摸移动
            if (this.callbacks.onTouchpadMove) {
                this.callbacks.onTouchpadMove(1, touchpad.touch1.normalized_x, touchpad.touch1.normalized_y);
            }
        }

        // Touch 2
        if (touchpad.touch2.active && !this.prevTouchpad.touch2.active) {
            if (this.callbacks.onTouchpadTouch) {
                this.callbacks.onTouchpadTouch(2, touchpad.touch2.normalized_x, touchpad.touch2.normalized_y);
            }
        } else if (!touchpad.touch2.active && this.prevTouchpad.touch2.active) {
            if (this.callbacks.onTouchpadRelease) {
                this.callbacks.onTouchpadRelease(2);
            }
        } else if (touchpad.touch2.active && this.prevTouchpad.touch2.active) {
            if (this.callbacks.onTouchpadMove) {
                this.callbacks.onTouchpadMove(2, touchpad.touch2.normalized_x, touchpad.touch2.normalized_y);
            }
        }

        this.prevTouchpad = JSON.parse(JSON.stringify(touchpad));
    }

    onError(error) {
        console.error('[PS5] WebSocket错误:', error);
    }

    onClose() {
        console.log('[PS5] ❌ 与服务器断开连接');
        this.connected = false;

        if (this.callbacks.onDisconnect) {
            this.callbacks.onDisconnect();
        }

        this.scheduleReconnect();
    }

    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[PS5] 重连次数超过限制，停止重连');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * this.reconnectAttempts;

        console.log(`[PS5] ${delay / 1000}秒后尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        setTimeout(() => {
            this.connect();
        }, delay);
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
    }

    /**
     * 发送震动命令
     */
    vibrate(left, right, duration = 200) {
        if (!this.connected) return;

        this.send({
            type: 'vibrate',
            left: left,
            right: right,
            duration: duration
        });
    }

    /**
     * 设置LED颜色
     */
    setLED(r, g, b) {
        if (!this.connected) return;

        this.send({
            type: 'set_led',
            r: r,
            g: g,
            b: b
        });
    }

    /**
     * 设置自适应扳机模式
     */
    setTriggerMode(trigger, mode) {
        if (!this.connected) return;

        this.send({
            type: 'set_trigger_mode',
            trigger: trigger,  // 'left', 'right', 'both'
            mode: mode  // 'off', 'rigid', 'pulse', 'rigid_ab', 'pulse_ab'
        });
    }

    /**
     * 启用/禁用麦克风检测
     */
    enableMicrophone(enable = true) {
        if (!this.connected) return;

        this.send({
            type: 'enable_microphone',
            enable: enable
        });
    }

    /**
     * 发送数据到服务器
     */
    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    /**
     * 设置事件回调
     */
    on(eventName, callback) {
        const callbackName = 'on' + eventName.charAt(0).toUpperCase() + eventName.slice(1);
        if (this.callbacks.hasOwnProperty(callbackName)) {
            this.callbacks[callbackName] = callback;
        }
    }

    // === 便捷方法 ===

    isButtonPressed(buttonName) {
        return this.state.buttons[buttonName] || false;
    }

    getLeftStick() {
        return {
            x: this.state.sticks?.left?.normalized_x || 0,
            y: this.state.sticks?.left?.normalized_y || 0
        };
    }

    getRightStick() {
        return {
            x: this.state.sticks?.right?.normalized_x || 0,
            y: this.state.sticks?.right?.normalized_y || 0
        };
    }

    getTriggerPressure(trigger) {
        if (trigger === 'L2') {
            return this.state.triggers?.L2_normalized || 0;
        } else if (trigger === 'R2') {
            return this.state.triggers?.R2_normalized || 0;
        }
        return 0;
    }

    getTouchpad() {
        return this.state.touchpad || { touch1: {}, touch2: {} };
    }

    getGyro() {
        return this.state.gyro || {};
    }

    getAccelerometer() {
        return this.state.accelerometer || {};
    }

    getBattery() {
        return this.state.battery || {};
    }

    getState() {
        return {
            connected: this.connected,
            ...this.state
        };
    }
}

// 默认导出
export default PS5ControllerClient;
