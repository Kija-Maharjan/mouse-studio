from flask import Flask, render_template, request, jsonify, send_file
import os
import json
from datetime import datetime
from werkzeug.utils import secure_filename
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'orders')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

ORDER_COUNTER_FILE = os.path.join(os.path.dirname(__file__), 'order_counter.json')

# Real product sizes in mm → we render previews at high resolution
SIZE_MAP = {
    '400mm x 450mm': (400, 450),
    '700mm x 300mm': (700, 300),
    '900mm x 400 mm': (900, 400),
    '900mm x 400mm': (900, 400),
}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_next_order_number():
    if os.path.exists(ORDER_COUNTER_FILE):
        with open(ORDER_COUNTER_FILE, 'r') as f:
            data = json.load(f)
            counter = data.get('counter', 100000)
    else:
        counter = 100000
    counter += 1
    with open(ORDER_COUNTER_FILE, 'w') as f:
        json.dump({'counter': counter}, f)
    return f"#{counter}"

def create_preview_image(artwork_path, size_str, order_number, product_name, date_str):
    """
    Create a high-quality preview image of the mousepad with artwork
    fitted inside a black rounded rectangle of the correct aspect ratio.
    """
    # Determine dimensions (use mm as pixels for high-res, then we can scale)
    dims = SIZE_MAP.get(size_str.strip(), (400, 450))
    pad_w, pad_h = dims

    # Scale for nice download size (max dimension ~1200px)
    max_side = 1200
    scale = min(max_side / pad_w, max_side / pad_h)
    out_w = int(pad_w * scale)
    out_h = int(pad_h * scale)

    # Create canvas with slight padding and soft background
    padding = 60
    canvas_w = out_w + padding * 2
    canvas_h = out_h + padding * 2 + 90  # extra space for order text

    # Warm gradient-ish background
    canvas = Image.new('RGB', (canvas_w, canvas_h), (255, 240, 230))
    draw = ImageDraw.Draw(canvas)

    # Soft orange gradient simulation
    for y in range(canvas_h):
        r = int(255 - (y / canvas_h) * 30)
        g = int(240 - (y / canvas_h) * 60)
        b = int(230 - (y / canvas_h) * 40)
        draw.line([(0, y), (canvas_w, y)], fill=(r, g, b))

    # Load and fit artwork
    try:
        artwork = Image.open(artwork_path).convert('RGBA')
    except Exception:
        artwork = Image.new('RGBA', (out_w, out_h), (30, 30, 30, 255))

    # Cover-fit the artwork into the mousepad size
    art_ratio = artwork.width / artwork.height
    pad_ratio = out_w / out_h

    if art_ratio > pad_ratio:
        # Artwork is wider → fit height, crop width
        new_h = out_h
        new_w = int(new_h * art_ratio)
        artwork = artwork.resize((new_w, new_h), Image.Resampling.LANCZOS)
        left = (new_w - out_w) // 2
        artwork = artwork.crop((left, 0, left + out_w, out_h))
    else:
        # Artwork is taller → fit width, crop height
        new_w = out_w
        new_h = int(new_w / art_ratio)
        artwork = artwork.resize((new_w, new_h), Image.Resampling.LANCZOS)
        top = (new_h - out_h) // 2
        artwork = artwork.crop((0, top, out_w, top + out_h))

    # Create the black mousepad shape with rounded corners
    mousepad = Image.new('RGBA', (out_w, out_h), (0, 0, 0, 0))
    mp_draw = ImageDraw.Draw(mousepad)

    radius = max(12, int(min(out_w, out_h) * 0.04))
    # Dark base
    mp_draw.rounded_rectangle([0, 0, out_w - 1, out_h - 1], radius=radius, fill=(26, 26, 26, 255))

    # Paste artwork with rounded mask
    mask = Image.new('L', (out_w, out_h), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([2, 2, out_w - 3, out_h - 3], radius=radius - 2, fill=255)

    mousepad.paste(artwork, (0, 0), mask)

    # Subtle border
    mp_draw.rounded_rectangle([0, 0, out_w - 1, out_h - 1], radius=radius, outline=(50, 50, 50, 255), width=3)

    # Paste mousepad onto canvas
    canvas.paste(mousepad, (padding, padding), mousepad)

    # Order info text at the bottom
    try:
        font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
    except Exception:
        font_large = ImageFont.load_default()
        font_small = ImageFont.load_default()

    text_y = padding + out_h + 18
    draw.text((padding, text_y), f"Mousepad Studio  •  {order_number}", fill=(60, 60, 60), font=font_large)
    draw.text((padding, text_y + 30), f"{product_name}  •  {size_str}  •  {date_str}", fill=(90, 90, 90), font=font_small)

    return canvas


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/place-order', methods=['POST'])
def place_order():
    if 'artwork' not in request.files:
        return jsonify({'error': 'No artwork uploaded'}), 400

    file = request.files['artwork']
    size = request.form.get('size', '')
    product_name = request.form.get('product_name', '')

    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type'}), 400

    order_number = get_next_order_number()
    date_str = datetime.now().strftime('%Y-%m-%d')
    time_str = datetime.now().strftime('%H%M%S')

    size_clean = size.replace(' ', '').replace('mm', 'mm')
    original_ext = file.filename.rsplit('.', 1)[1].lower()
    safe_name = secure_filename(file.filename.rsplit('.', 1)[0])[:50]

    folder_name = f"{order_number}_{date_str}_{size_clean}"
    order_dir = os.path.join(app.config['UPLOAD_FOLDER'], folder_name)
    os.makedirs(order_dir, exist_ok=True)

    filename = f"{order_number}_{date_str}_{size_clean}_{safe_name}.{original_ext}"
    filepath = os.path.join(order_dir, filename)
    file.save(filepath)

    # Generate and save the preview image right away
    try:
        preview = create_preview_image(filepath, size, order_number, product_name, date_str)
        preview_path = os.path.join(order_dir, f"{order_number}_preview.png")
        preview.save(preview_path, 'PNG', quality=95)
    except Exception as e:
        preview_path = None
        print("Preview generation error:", e)

    meta = {
        'order_number': order_number,
        'date': date_str,
        'time': time_str,
        'size': size,
        'product_name': product_name,
        'filename': filename,
        'original_filename': file.filename,
        'preview': f"{order_number}_preview.png" if preview_path else None
    }
    with open(os.path.join(order_dir, 'order_info.json'), 'w') as f:
        json.dump(meta, f, indent=2)

    return jsonify({
        'success': True,
        'order_number': order_number,
        'size': size,
        'product_name': product_name,
        'date': date_str,
        'folder': folder_name
    })


@app.route('/api/download-order/<order_number>', methods=['GET'])
def download_order(order_number):
    """Download the visual preview image of the ordered mousepad."""
    # Accept both "100001" and "#100001"
    if not order_number.startswith('#'):
        order_number = '#' + order_number

    for folder in os.listdir(app.config['UPLOAD_FOLDER']):
        if folder.startswith(order_number):
            order_dir = os.path.join(app.config['UPLOAD_FOLDER'], folder)
            info_path = os.path.join(order_dir, 'order_info.json')
            if not os.path.exists(info_path):
                continue

            with open(info_path, 'r') as f:
                meta = json.load(f)

            # Prefer already-generated preview
            preview_name = meta.get('preview')
            if preview_name:
                preview_path = os.path.join(order_dir, preview_name)
                if os.path.exists(preview_path):
                    return send_file(
                        preview_path,
                        mimetype='image/png',
                        as_attachment=True,
                        download_name=f"order_{order_number}_preview.png"
                    )

            # Fallback: generate on the fly
            artwork_path = os.path.join(order_dir, meta['filename'])
            if os.path.exists(artwork_path):
                img = create_preview_image(
                    artwork_path,
                    meta['size'],
                    meta['order_number'],
                    meta['product_name'],
                    meta['date']
                )
                buf = BytesIO()
                img.save(buf, format='PNG')
                buf.seek(0)
                return send_file(
                    buf,
                    mimetype='image/png',
                    as_attachment=True,
                    download_name=f"order_{order_number}_preview.png"
                )

    return jsonify({'error': 'Order not found'}), 404


if __name__ == '__main__':
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    app.run(host='0.0.0.0', port=5000, debug=True)
