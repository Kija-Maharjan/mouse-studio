import pathlib, xml.etree.ElementTree as ET
base=pathlib.Path('pptx_extracted/pptx_contents')
ns={'a':'http://schemas.openxmlformats.org/drawingml/2006/main','p':'http://schemas.openxmlformats.org/presentationml/2006/main'}
for path in [base / 'ppt' / 'slides' / 'slide1.xml', base / 'ppt' / 'slideMasters' / 'slideMaster1.xml']:
    print('---', path)
    tree=ET.parse(path)
    root=tree.getroot()
    for idx, sp in enumerate(root.findall('.//p:sp', ns), start=1):
        name=sp.find('.//p:cNvPr', ns).attrib.get('name','')
        tx=''.join([t.text or '' for t in sp.findall('.//a:t', ns)])
        xfrm=sp.find('.//p:spPr/a:xfrm', ns)
        if xfrm is not None:
            off=xfrm.find('a:off', ns); ext=xfrm.find('a:ext', ns)
            pos=(off.attrib['x'], off.attrib['y']) if off is not None else ('', '')
            size=(ext.attrib['cx'], ext.attrib['cy']) if ext is not None else ('', '')
        else:
            pos=size=('','')
        fill=sp.find('.//a:solidFill/a:srgbClr', ns)
        fillval=fill.attrib['val'] if fill is not None else ''
        print(f'SHAPE {idx}: name={name!r} text={tx!r} pos={pos} size={size} fill={fillval}')
    print('--- end')
