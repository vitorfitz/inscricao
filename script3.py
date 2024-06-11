import cv2
import numpy as np
import math
from PIL import Image

image=cv2.imread('boulder.png',cv2.IMREAD_UNCHANGED)
newImg=np.copy(image)

for y in range(len(image)):
    for x in range(len(image[0])):
        for k in range(3):
            newImg[y][x][k]=0
        if (image[y][x][0]>0 and image[y][x][3]>0) or image[y][x][3]==133:
            # if image[y][x][3]!=133:
            #     print("pixel ("+str(x)+", "+str(y)+"): alpha "+str(image[y][x][3])+", red "+str(image[y][x][0]))
            newImg[y][x][3]=128
        else:
            newImg[y][x][3]=image[y][x][3]

cv2.imwrite("output_boulder.png", newImg)