import numpy as np, sys
from PIL import Image
def read_hdr(p):
    b=open(p,'rb').read(); i=0
    while True:
        j=b.index(b'\n',i); line=b[i:j]; i=j+1
        if line.strip()==b'': break
    j=b.index(b'\n',i); dims=b[i:j].split(); i=j+1
    H=int(dims[1]); W=int(dims[3]); out=np.zeros((H,W,4),np.uint8)
    for y in range(H):
        if b[i]==2 and b[i+1]==2:
            i+=4
            for c in range(4):
                x=0
                while x<W:
                    n=b[i]; i+=1
                    if n>128:
                        n-=128; out[y,x:x+n,c]=b[i]; i+=1
                    else:
                        out[y,x:x+n,c]=np.frombuffer(b[i:i+n],np.uint8); i+=n
                    x+=n
        else:
            out[y]=np.frombuffer(b[i:i+W*4],np.uint8).reshape(W,4); i+=W*4
    e=out[...,3].astype(np.float32)
    f=np.where(out[...,3]>0, np.ldexp(1.0,(out[...,3].astype(int)-136)),0).astype(np.float32)
    return out[...,:3].astype(np.float32)*f[...,None]
def write_hdr(p,img):
    H,W,_=img.shape; m=img.max(-1); e=np.ceil(np.log2(np.maximum(m,1e-32))).astype(int)
    sc=np.where(m>1e-32, 256.0/np.exp2(e),0)
    rgb=np.clip(img*sc[...,None],0,255).astype(np.uint8); ee=np.where(m>1e-32,e+128,0).astype(np.uint8)
    data=np.concatenate([rgb,ee[...,None]],-1)
    with open(p,'wb') as f:
        f.write(b'#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y %d +X %d\n'%(H,W)); f.write(data.tobytes())
def down(img,W,H):
    h,w,_=img.shape; return img.reshape(H,h//H,W,w//W,3).mean((1,3))
if __name__=='__main__':
    for n in sys.argv[1:]:
        img=read_hdr('hdri/'+n); s=down(img,256,128)
        write_hdr('hdri/'+n.replace('_1k','_256'),s)
        prev=(s/(1+s))**(1/2.2); Image.fromarray((prev*255).astype(np.uint8)).resize((512,256)).save('hdri/'+n+'.png')
        print(n, img.shape, s.max())
