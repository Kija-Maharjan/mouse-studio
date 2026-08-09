import pathlib, xml.etree.ElementTree as ET
base = pathlib.Path('pptx_extracted/pptx_contents')
for path in [base / 'ppt' / 'theme' / 'theme1.xml', base / 'ppt' / 'slides' / 'slide1.xml']:
    print('---', path)
    tree = ET.parse(path)
    root = tree.getroot()
    ns = {'a':'http://schemas.openxmlformats.org/drawingml/2006/main', 'p':'http://schemas.openxmlformats.org/presentationml/2006/main'}
    if path.name == 'theme1.xml':
        for child in root.findall('.//a:clrScheme/*', ns):
            print(child.tag.split('}',1)[1], child.find('a:srgbClr', ns).attrib.get('val') if child.find('a:srgbClr', ns) is not None else 'sys', child.find('a:sysClr', ns).attrib.get('lastClr') if child.find('a:sysClr', ns) is not None else '')
        for face in root.findall('.//a:latin', ns):
            print('font', face.attrib.get('typeface'))
    else:
        # list background and title shapes
        bgs = root.findall('.//p:bgPr', ns)
        for bg in bgs:
            print('bg', ET.tostring(bg, encoding='unicode'))
        for tx in root.findall('.//p:sp', ns):
            ph = tx.find('.//p:ph', ns)
            if ph is not None:
                print('placeholder', ph.attrib)
            text = ''.join([t.text or '' for t in tx.findall('.//a:t', ns)])
            if text.strip():
                print('text', repr(text.strip()))
