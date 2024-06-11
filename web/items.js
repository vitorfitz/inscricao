"use strict"

let itemTypes=[];
class Item{
    constructor(name,desc,file,lots,func){
        this.name=name;
        this.desc=desc;
        this.lots=lots;
        this.func=func;
        this.id=itemTypes.length;
        itemTypes.push(this);

        if(!(file in imgMap)){
            imgMap[file]=new ImgWrapper("items/"+file);
        }
        this.file=imgMap[file];
    }
}

const rockItem=new Item("Boulder in a Bottle","Obtenha uma Pedra 0/4.","boulder.webp",()=>1,async function(){
    await game.addCardToHand(c_rock,game.turn);
});

const pliersItem=new Item("Alicate","Causa 2 de dano ao oponente.","pliers.webp",()=>1,async function(){
    await game.tiltScales(2,null,null);
});

const bonesItem=new Item("Cofrinho","Ganhe 2 ossos.","bones.webp",()=>1,async function(){
    game.bones[game.turn]+=2;
    updateBones(game.turn);
});

function closeItemModal(){
    itemModal.style.opacity="0";
    itemModal.style.visibility="hidden";
    itemModal.style.transitionDelay="0ms";
}

function addItem(it){
    run.items.push(it);
}

const itemModal=document.querySelector("#itemModal");
const closeIM=itemModal.querySelector(".close");
closeIM.addEventListener("click",function(){ closeItemModal(); });
i_sigils.draw(closeIM.getContext("2d"),2,...[s_sidestep.coords],0,0);
const itemPres=document.querySelector("#itemPick");