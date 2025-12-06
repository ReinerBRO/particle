import os
import base64
import tempfile
import json
import subprocess
import threading
import urllib.request
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dashscope import Generation
from dashscope.audio.asr import TranslationRecognizerChat, TranslationRecognizerCallback
import dashscope
from dotenv import load_dotenv

# Try to get ffmpeg path from imageio-ffmpeg
try:
    import imageio_ffmpeg
    FFMPEG_PATH = imageio_ffmpeg.get_ffmpeg_exe()
    print(f"[INFO] Using ffmpeg from imageio-ffmpeg: {FFMPEG_PATH}")
except ImportError:
    FFMPEG_PATH = 'ffmpeg'
    print("[INFO] imageio-ffmpeg not found, using system ffmpeg")

# Load environment variables from .env file
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

app = Flask(__name__, static_folder='../frontend/particle', static_url_path='')
CORS(app)

# Configure API Key
API_KEY = os.environ.get("DASHSCOPE_API_KEY")
if API_KEY:
    dashscope.api_key = API_KEY
else:
    print("Warning: DASHSCOPE_API_KEY environment variable not set!")

# 故事存储文件路径
STORIES_FILE = os.path.join(os.path.dirname(__file__), 'stories.json')

# 图片存储路径
STORY_IMAGES_REL_PATH = 'story_images'
STORY_IMAGES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'frontend', 'particle', STORY_IMAGES_REL_PATH)

if not os.path.exists(STORY_IMAGES_DIR):
    os.makedirs(STORY_IMAGES_DIR)
    print(f"[INFO] Created story images directory: {STORY_IMAGES_DIR}")

def load_stories():
    """加载故事列表"""
    if os.path.exists(STORIES_FILE):
        try:
            with open(STORIES_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return []
    return []

def save_stories(stories):
    """保存故事列表"""
    with open(STORIES_FILE, 'w', encoding='utf-8') as f:
        json.dump(stories, f, ensure_ascii=False, indent=2)


# Gummy ASR Callback to collect transcription result
class GummyCallback(TranslationRecognizerCallback):
    def __init__(self):
        self.final_text = ""
        self.completed = threading.Event()
        self.error = None
    
    def on_open(self):
        print("[Gummy] Connection opened")
    
    def on_event(self, request_id, transcription_result, translation_result, usage):
        if transcription_result and transcription_result.is_sentence_end:
            self.final_text = transcription_result.text
            print(f"[Gummy] Final transcription: {self.final_text}")
    
    def on_complete(self):
        print("[Gummy] Recognition completed")
        self.completed.set()
    
    def on_error(self, result):
        print(f"[Gummy] Error: {result}")
        self.error = str(result)
        self.completed.set()
    
    def on_close(self):
        print("[Gummy] Connection closed")
        self.completed.set()


@app.route('/')
def index():
    return send_from_directory('../frontend/particle', 'skeleton.html')

@app.route('/models/<path:filename>')
def serve_models(filename):
    return send_from_directory('../models', filename)

@app.route('/js/<path:filename>')
def serve_js(filename):
    return send_from_directory('../frontend/particle/js', filename)


# ============ 故事存储 API ============

@app.route('/api/stories', methods=['GET'])
def get_stories():
    """获取所有保存的故事"""
    stories = load_stories()
    return jsonify(stories)

@app.route('/api/stories', methods=['POST'])
def add_story():
    """添加新故事"""
    data = request.json
    user_text = data.get('userText', '')
    poem_text = data.get('poemText', '')
    image_url = data.get('imageUrl', '')
    
    if not poem_text:
        return jsonify({"error": "No poem text provided"}), 400
    
    stories = load_stories()
    
    new_story = {
        "id": len(stories) + 1,
        "userText": user_text,
        "poemText": poem_text,
        "imageUrl": image_url,
        "timestamp": datetime.now().isoformat(),
    }
    
    stories.append(new_story)
    save_stories(stories)
    
    print(f"[Story] Saved new story #{new_story['id']}: {user_text[:30]}...")
    return jsonify(new_story)

@app.route('/api/stories/<int:story_id>', methods=['DELETE'])
def delete_story(story_id):
    """删除指定故事"""
    stories = load_stories()
    stories = [s for s in stories if s.get('id') != story_id]
    save_stories(stories)
    return jsonify({"success": True})


@app.route('/api/generate-poem', methods=['POST'])
def generate_poem():
    try:
        data = request.json
        audio_base64 = data.get('audio')
        
        # Debug: Check if audio data received
        print(f"[DEBUG] Received request with audio data: {len(audio_base64) if audio_base64 else 0} bytes (base64)")
        
        if not audio_base64:
            return jsonify({"error": "No audio data provided"}), 400

        # Decode audio
        audio_data = base64.b64decode(audio_base64)
        print(f"[DEBUG] Decoded audio size: {len(audio_data)} bytes")
        
        # Check if audio data is too small (likely empty/silent)
        if len(audio_data) < 1000:
            print(f"[WARNING] Audio data is very small, might be empty!")
        
        # Detect audio format from header
        audio_format = 'webm'  # Default to webm (browser default)
        if audio_data[:4] == b'RIFF':
            audio_format = 'wav'
        elif audio_data[:4] == b'\x1aE\xdf\xa3':  # WebM/Matroska magic bytes
            audio_format = 'webm'
        elif audio_data[:3] == b'ID3' or audio_data[:2] == b'\xff\xfb':
            audio_format = 'mp3'
        
        print(f"[DEBUG] Detected audio format: {audio_format}")
        
        # Save to temp file
        with tempfile.NamedTemporaryFile(suffix=f'.{audio_format}', delete=False) as temp_audio:
            temp_audio.write(audio_data)
            temp_audio_path = temp_audio.name
        
        print(f"[DEBUG] Saved temp file: {temp_audio_path}, size: {os.path.getsize(temp_audio_path)} bytes")

        wav_path = None
        try:
            # Convert WebM to WAV using ffmpeg (required for Gummy)
            wav_path = temp_audio_path.replace(f'.{audio_format}', '.wav')
            if audio_format != 'wav':
                print(f"[DEBUG] Converting {audio_format} to WAV using ffmpeg...")
                try:
                    result = subprocess.run([
                        FFMPEG_PATH, '-y', '-i', temp_audio_path,
                        '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1',
                        wav_path
                    ], capture_output=True, text=True, timeout=30)
                    if result.returncode != 0:
                        print(f"[ERROR] ffmpeg failed: {result.stderr}")
                        return jsonify({"error": "Audio conversion failed", "details": result.stderr}), 500
                    print(f"[DEBUG] Converted to WAV: {wav_path}")
                except FileNotFoundError:
                    print("[ERROR] ffmpeg not found! Please install ffmpeg.")
                    return jsonify({"error": "ffmpeg not installed"}), 500
            else:
                wav_path = temp_audio_path
            
            # 1. ASR: Use Gummy one-sentence recognition (supports local audio)
            print(f"[DEBUG] Processing audio with Gummy... {wav_path}")
            
            callback = GummyCallback()
            recognizer = TranslationRecognizerChat(
                model='gummy-chat-v1',
                format='wav',
                sample_rate=16000,
                transcription_enabled=True,
                translation_enabled=False,
                callback=callback
            )
            
            # Start recognition
            recognizer.start()
            
            # Read WAV file and send audio frames
            with open(wav_path, 'rb') as wav_file:
                # Skip WAV header (44 bytes)
                wav_file.read(44)
                
                # Send audio in chunks (approximately 100ms per chunk at 16kHz, 16-bit mono = 3200 bytes)
                chunk_size = 3200
                while True:
                    chunk = wav_file.read(chunk_size)
                    if not chunk:
                        break
                    can_continue = recognizer.send_audio_frame(chunk)
                    if not can_continue:
                        print("[DEBUG] Gummy detected end of sentence, stopping send")
                        break
            
            # Stop and wait for completion
            recognizer.stop()
            callback.completed.wait(timeout=30)
            
            asr_text = callback.final_text
            if callback.error:
                print(f"[ERROR] Gummy error: {callback.error}")
            
            if not asr_text:
                print(f"[WARNING] No speech detected in audio!")
                asr_text = "(无语音内容)"
            
            print(f"[DEBUG] ASR Text Result: {asr_text}")

            # 2. LLM: Qwen-Plus - 文学大师风格 + 图像提示词生成
            prompt = f'''你是一位饱读诗书的文学大师，精通古今中外文学典籍。用户刚刚分享了一段心声：
"{asr_text}"

请完成两项任务：
1. 以最高文学水准创作一段文字作为回应（诗歌/散文/哲思短句）。
2. 基于你的创作内容，生成一段用于AI绘画的提示词（Prompt）。

【任务一：文学创作原则】
- **情感共鸣**：深入体察用户言语中的情感基调与心境
- **引经据典**：可巧妙引用中西方经典，但需自然融入
- **意境营造**：创造画面感与情感共鸣
- **形式自由**：形式服务于内容
- **长度限制**：60字以内

【任务二：绘画提示词生成规则】
提示词 = 主体（主体描述）+ 场景（场景描述）+ 风格（定义风格）+ 镜头语言 + 氛围词 + 细节修饰
- **主体描述**：清晰描述图像主体
- **场景描述**：环境特征细节
- **定义风格**：如"水彩风格"、"油画风格"、"梦幻插画"等
- **镜头语言**：景别、视角等
- **氛围词**：如"梦幻"、"温暖"、"孤独"等
- **细节修饰**：光源、道具、环境细节等
- **长度限制**：200字左右，确保生图速度

【输出格式】
请仅输出一个标准的 JSON 对象，不要包含任何其他文字或Markdown标记：
{{
    "poem": "你的文学创作内容",
    "image_prompt": "你的绘画提示词"
}}
'''

            print("[DEBUG] Calling Qwen-Plus...")
            llm_result = Generation.call(
                model='qwen-plus',
                messages=[
                    {'role': 'system', 'content': '你是一位饱读诗书的文学大师，同时也是一位精通视觉艺术的导演。请以JSON格式输出你的创作。'},
                    {'role': 'user', 'content': prompt}
                ],
                result_format='message'
            )

            if llm_result.status_code != 200:
                print(f"[ERROR] LLM Error: {llm_result}")
                return jsonify({"error": "LLM failed", "details": str(llm_result)}), 500

            content = llm_result.output.choices[0].message.content
            print(f"[DEBUG] LLM Response: {content}")
            
            # Parse JSON
            try:
                # Clean up potential markdown code blocks
                if content.startswith('```json'):
                    content = content[7:]
                if content.endswith('```'):
                    content = content[:-3]
                
                result_json = json.loads(content.strip())
                poem_text = result_json.get('poem', '')
                image_prompt = result_json.get('image_prompt', '')
            except json.JSONDecodeError:
                print("[ERROR] Failed to parse LLM JSON response")
                poem_text = content # Fallback
                image_prompt = f"Christmas atmosphere, magical, {asr_text}" # Fallback prompt

            print(f"[DEBUG] Poem: {poem_text}")
            print(f"[DEBUG] Image Prompt: {image_prompt}")

            # 3. Image Generation: Wan2.2-T2I-Flash
            image_url = ""
            if image_prompt:
                try:
                    print("[DEBUG] Calling Wan2.2-T2I-Flash...")
                    img_rsp = dashscope.ImageSynthesis.call(
                        model="wan2.2-t2i-flash",
                        prompt=image_prompt,
                        n=1,
                        size='1280*960',
                        negative_prompt="低分辨率、错误、最差质量、低质量、残缺、多余的手指、比例不良"
                    )
                    
                    if img_rsp.status_code == 200:
                        remote_url = img_rsp.output.results[0].url
                        print(f"[DEBUG] Image generated: {remote_url}")
                        
                        # Download and save locally
                        try:
                            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                            filename = f"story_{timestamp}.png"
                            local_path = os.path.join(STORY_IMAGES_DIR, filename)
                            
                            print(f"[DEBUG] Downloading image to {local_path}")
                            urllib.request.urlretrieve(remote_url, local_path)
                            
                            # Set image_url to relative path for frontend
                            image_url = f"{STORY_IMAGES_REL_PATH}/{filename}"
                            print(f"[DEBUG] Image saved locally: {image_url}")
                        except Exception as dl_err:
                            print(f"[ERROR] Failed to download image: {dl_err}")
                            # Fallback to remote URL if download fails
                            image_url = remote_url
                    else:
                        print(f"[ERROR] Image Gen Failed: {img_rsp.code}, {img_rsp.message}")
                except Exception as img_err:
                    print(f"[ERROR] Image Gen Exception: {img_err}")

            # 返回用户原话、生成的诗歌和图片URL
            return jsonify({
                "text": poem_text, 
                "userText": asr_text,
                "imageUrl": image_url
            })

        finally:
            # Cleanup temp files
            if os.path.exists(temp_audio_path):
                os.remove(temp_audio_path)
            if wav_path and wav_path != temp_audio_path and os.path.exists(wav_path):
                os.remove(wav_path)

    except Exception as e:
        import traceback
        print(f"[ERROR] Server Error: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000, debug=True)
