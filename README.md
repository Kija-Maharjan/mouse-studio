# Mousepad Studio

A web application recreating the design and layout from the Mousepad Studio PowerPoint presentation.

## Features

- **3 Products** with different sizes:
  1. Standard 400mm × 450mm
  2. Desk Mat 700mm × 300mm
  3. XL Desk Mat 900mm × 400mm

- Carousel navigation (arrows + dots) to switch between products
- Drag & Drop / Browse image upload for artwork
- Live preview of artwork on the product shape
- **Place Order** button opens a confirmation popup (matching slide 4 design)
- Order number auto-generated (starting from #100001)
- Uploaded images saved in dedicated folders:
  ```
  orders/
    #100001_2026-08-09_900mmx400mm/
      ├── #100001_2026-08-09_900mmx400mm_artwork.png
      └── order_info.json
  ```
- Download Order Copy as text file
- Responsive design matching the original gradient background and card layout

## How to Run

1. Install dependencies:
   ```bash
   pip install flask
   ```

2. Start the server:
   ```bash
   cd mousepad-studio
   python app.py
   ```

3. Open in browser:
   ```
   http://127.0.0.1:5000
   ```

## Usage

1. Use the left/right arrows or dots to select a product size.
2. Drag & drop an image (or click "browse") into the upload area.
3. Click **Place order**.
4. In the popup you will see the Order number and size.
5. Click **Download Order Copy.** to get a text summary.
6. Click **Conform order** to close the confirmation.

Images and order metadata are saved under the `orders/` folder.
