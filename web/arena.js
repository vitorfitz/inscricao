let run;
class Run{
    constructor(tippingPoint=5,cardsPerTurn=1,lifeTotal=20,lanes=4){
        this.tippingPoint=tippingPoint;
        this.cardsPerTurn=cardsPerTurn;
        this.lifeTotal=lifeTotal;
        this.lanes=lanes;
    }

    freshStart(){
        this.life=[this.lifeTotal,this.lifeTotal];
        this.decks=[];
    }
}

class ModdedCard{
    constructor(c){
        this.card=c;
        this.atkBoost=0;
        this.hpBoost=0;
        this.extraSigs=[];
        this.extraAct=null;
    }
}

const cardSelect=document.querySelector("#card_choice");
function newRun(configs){
    run=new Run(configs.tippingPoint,configs.cardsPerTurn,configs.lifeTotal);
    cardSelect.style.visibility="visible";
}