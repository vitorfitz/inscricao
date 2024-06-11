import cv2
import numpy as np
import math
from PIL import Image

sus=cv2.imread('Boulder.webp')
orig=cv2.cvtColor(sus, cv2.COLOR_BGR2RGB)
image = cv2.cvtColor(sus, cv2.COLOR_BGR2GRAY)
thresh=35

ch=[]
peaks=[]
estimated=[]

for dir in range(2):
    size=image.shape[1-dir]-1
    ch.append([0]*size)
    peaks.append([])

    for h in range(image.shape[dir]):
        for i in range(image.shape[1-dir]-1):
            if (dir==0 and abs(int(image[h,i]) - int(image[h,i+1])) > thresh) \
            or (dir==1 and abs(int(image[i,h]) - int(image[i+1,h])) > thresh):
                ch[dir][i]+=1

    for i in range(1, size - 1):
        if ch[dir][i] > ch[dir][i - 1] and ch[dir][i] > ch[dir][i + 1]:
            peaks[dir].append(i)

    sum=0
    measures=0
    avg=3.5

    for i in range(len(peaks[dir])-1):
        diff=peaks[dir][i+1]-peaks[dir][i]
        if diff>=1.5*avg:
            continue
        measures+=1
        sum+=diff
        avg=sum/measures
    
    estimated.append(avg)

avg=(estimated[0]+estimated[1])/2
inis=[]
for dir in range(2):
    inis.append(math.fmod(peaks[dir][0]+avg/2,avg))

newImg=[]
y_old=inis[0]

while y_old<image.shape[0]-0.5:
    x_old=inis[1]
    newImg.append([])
    while x_old<image.shape[1]-0.5:
        newImg[-1].append(orig[round(y_old)][round(x_old)])
        x_old+=avg
    y_old+=avg

def create_image_from_array(array):
    img = Image.new('RGB', (len(array[0]), len(array)))
    pixels = img.load()

    for y in range(len(array)):
        for x in range(len(array[0])):
            p=array[y][x]
            pixels[x, y] = (p[0], p[1], p[2])

    return img

img = create_image_from_array(newImg)
img.save('output.png')