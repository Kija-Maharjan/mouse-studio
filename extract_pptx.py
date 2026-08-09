import zipfile, pathlib, shutil
p = pathlib.Path(r'pptx_extracted\\Mousepad studio.pptx')
print('exists', p.exists())
print('suffix', p.suffix)
print('is_zip', zipfile.is_zipfile(p))
dest = pathlib.Path(r'pptx_extracted\\pptx_contents')
shutil.rmtree(dest, ignore_errors=True)
with zipfile.ZipFile(p) as z:
    z.extractall(dest)
print('extracted')
for x in sorted(dest.rglob('*'))[:200]:
    print(x)
