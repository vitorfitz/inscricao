const allSigils=[];
class Sigil{
    init(coords=null,name=null,desc=null,initData=function(card,sigil){}){
        this.name=name;
        this.desc=desc;
        this.coords=coords;

        // Listeners
        this.onCardPlayed=[]; // (me,played,sigilMemory)
        this.onCardDied=[]; // (me,killed,sigilMemory)
        this.onReceivedDmg=[]; // (dmg,me,attacked,sigilMemory) returns(dmg)
        this.onReceivedAttack=[]; // (me,attacker,attacked,sigilMemory)
        this.onTurnEnded=[]; // (me,sigilMemory)
        this.onFaceDmg=[]; // (dmg,me,attacker,targetPos,sigilMemory) returns(dmg)
        this.onCardMoved=[]; // (me,oldPos,mover,sigilMemory)
        this.onCardDrawn=[]; // (me,card,sigilMemory)

        // Functions
        this.onDealtDmg=null; // (dmg,me,attacked,sigilMemory)
        this.onDealtAttack=null; // (me,attacked,sigilMemory)
        this.modifyTargets=null; // (me,sigilMemory)

        this.initData=initData;
        
        if(coords!=null){
            const hash=coords[0]*100+coords[1];
            if(!coordsSet.has(hash)){
                coordsSet.add(hash);
                sigilCoords.push(coords);
            }
        }
        this.id=allSigils.length;
        allSigils.push(this);
    }

    toJSON(){
        return this.id;
    }
}

class SFledgling extends Sigil{
    init(biggerMe,name=null,desc=null){
        super.init([3,2],name,desc);
        this.biggerMe=biggerMe;
        this.onTurnEnded.push(new Listener(listen_enemy,async function(me){
            let big=GameCard.fromCard(biggerMe);
            big.health-=(me.baseHealth-me.health);
            if(big.baseHealth<me.baseHealth){
                big.baseHealth=me.baseHealth;
                big.health+=me.baseHealth-big.baseHealth;
            }
            if(big.health!=big.baseHealth || big.baseHealth<me.baseHealth) big.updateStat(1,big.health);
            removeCard(me);

            let listenersIHave=new Array(listenerRefs.length).fill(false);
            for(let h=0; h<listenerRefs.length; h++){
                for(let i=0; i<me.card.sigils.length; i++){
                    if(me.card.sigils[i][listenerFuncs[h]].length>0){
                        listenersIHave[h]=true;
                        break;
                    }
                }
            }

            for(let h=0; h<listenerRefs.length; h++){
                if(listenersIHave[h]){
                    for(let i=0; i<2; i++){
                        let l2=[];
                        for(let l of game[listenerRefs[h]][i]){
                            if(l.caller!=me) l2.push(l);
                        }
                        game[listenerRefs[h]][i]=l2;
                    }
                }
            }

            await big.place(me.pos,me.side);
        }.bind(this)))
    }
}

class SFrozen extends Sigil{
    init(futureMe,name=null,desc=null){
        super.init([3,4],name,desc);
        this.futureMe=futureMe;
        this.onCardDied.push(new Listener(listen_me,async function(me){
            // blockActions++;
            // updateBlockActions();
            // game.timeout(function(){
            //     await (GameCard.fromCard(this.futureMe,true)).place(me.pos);
            //     blockActions--;
            //     updateBlockActions();
            // }.bind(this),650)
            await (GameCard.fromCard(this.futureMe,true)).place(me.pos,me.side,false,800);
        }.bind(this)))
    }
}

class BuffSigil extends Sigil{
    init(coords,buff,name=null,desc=null,initData=function(card,sigil){}){
        super.init(coords,name,desc,initData);
        this.onCardMoved.push(new Listener(listen_me,async function(me,old_pos,_,memory){
            if(old_pos!=null){
                buff(-1,me,old_pos,memory);
            }
            buff(1,me,me.pos,memory);
        }));
        this.onCardDied.push(new Listener(listen_me,async function(me,_,memory){
            if(!me.inGame){
                return;
            }
            buff(-1,me,me.pos,memory);
        }));
    }
}

function moverTrans(el,dir){
    el.style.transform="rotateY("+((dir==1)==(game.myTurn==0)? 0: 180)+"deg)";
}

class SSpawner extends Sigil{
    init(coords,spawn,name=null,desc=null){
        super.init(coords,name,desc,initDirection);

        this.onTurnEnded.push(new Listener(listen_ally,async function(me,memory){
            let pos=me.pos;
            let att=pos+memory.direction;
            if(att>=game.lanes || att<0 || game.board[game.turn][att]!=null){
                memory.direction*=-1;
                moverTrans(memory.el,memory.direction);
                att=pos+memory.direction;
                if(att>=game.lanes || att<0 || game.board[game.turn][att]!=null){ att=pos; }
            }
            if(att!=pos){
                await me.place(att);
                if(spawn!=null){
                    await (GameCard.fromCard(spawn,true)).place(pos);
                }
            }
        }));
    }
}

class StatSigil extends Sigil{
    init(statCoords,name=null,desc=null,initData=function(card,sigil){}){
        super.init(null,name,desc,initData);
        this.statCoords=statCoords;
    }
}

const allActivated=[];
class Activated{
    init(coords,name,desc,func,
        conds=function(card,data,sigil){return true;},
        initData=function(card,sigil){}
    ){
        this.name=name;
        this.desc=desc;
        this.coords=coords;
        this.func=func;
        this.conds=conds;
        this.initData=initData;

        this.id=allActivated.length;
        allActivated.push(this);
    }

    toJSON(){
        return this.id;
    }
}

class VanillaActivated extends Activated{
    init(coords,cost,element,name,desc,func,
        conds=function(card,data,sigil){return true;},
        initData=function(card,sigil){}
    ){
        let conds2=function(card,data,sigil){
            return checkCost(element,cost) && conds(card,data,sigil);
        }
        let func2=function(card,data){
            spendResource(element,cost,card.side);
            func(card,data);
        };
        super.init(coords,name,desc,func2,conds2,initData);
    }
}

class Card{
    init(n,c,a,h,e,s,a2,p,collectible=true){
        this.name=n;
        this.attack=a;
        this.health=h;
        this.cost=c;
        this.element=e;
        this.sigils=s;
        this.activated=a2;
        this.portrait=p;

        if(e==bones && c>10){
            this.costXPos=1;
            this.costYPos=c-4;
        }
        else{
            this.costXPos=e;
            this.costYPos=c-1;
        }

        this.visibleSigils=[];
        this.statSigil=null;
        for(let sigil of s){
            if(sigil.coords!=null){
                this.visibleSigils.push(sigil);
            }
            else if(sigil instanceof StatSigil){
                this.statSigil=sigil;
            }
        }

        if(collectible){
            this.id=cards.length;
            cards.push(this);
        }
        this.jsonID=allCards.length;
        allCards.push(this);
    }

    renderAlsoReturnCtx(scale,unsac=this.hasSigil(s_cant_be_sacced)){
        const d=document.createElement("div");
        d.style.width=cardWidth*scale+"px";
        d.style.height=cardHeight*scale+"px";
        d.style.position="relative";

        const c=document.createElement("canvas");
        c.width=cardWidth*scale;
        c.height=cardHeight*scale;
        const ctx=c.getContext("2d");

        let sigilEls=[];
        function sigilElement(sig,type="canvas"){
            const tooltipEl=document.createElement(type);
            tooltipEl.className="ttTrigger";
            d.appendChild(tooltipEl);
            sigilEls.push(tooltipEl);

            tooltipEl.addEventListener("mouseenter",function(e){
                tooltip.style.opacity=1;
                tooltip.style.visibility="visible";
                tooltip.innerHTML="";
                if(sig.name!=null){
                    const h3=document.createElement("h3");
                    h3.textContent=sig.name;
                    tooltip.appendChild(h3);
                }
                if(sig.desc!=null){
                    const p=document.createElement("p");
                    p.textContent=sig.desc;
                    tooltip.appendChild(p);
                }
                hoveredTT=tooltipEl;
            });

            tooltipEl.addEventListener("mousemove",function(e){
                tooltip.style.left=e.pageX+"px";
                tooltip.style.top=e.pageY+"px";
            });

            tooltipEl.addEventListener("mouseleave",function(e){
                tooltip.style.opacity=0;
                tooltip.style.visibility="hidden";
                if(hoveredTT==tooltipEl) hoveredTT=null;
            });

            return tooltipEl;
        }

        let [cardX,cardY]=getBG(unsac);
        i_cards.draw(ctx,scale,cardX,cardY,0,0);
        i_portraits.draw(ctx,scale,this.portrait[0],this.portrait[1],1,1);
        i_numbers.draw(ctx,scale,this.health,0,hp_alignX,stats_alignY);

        if(this.statSigil!=null){
            let [cx,cy]=this.statSigil.statCoords;
            let ox=atk_alignX-1,oy=cardHeight-1-i_stats.dims[1];

            i_stats.draw(ctx,scale,cx,cy,ox,oy);
            const el=sigilElement(this.statSigil,"div");

            el.style.width=i_stats.dims[0]*scale+"px";
            el.style.height=i_stats.dims[1]*scale+"px";
            el.style.left=ox*scale+"px";
            el.style.top=oy*scale+"px";
        }
        else{
            i_numbers.draw(ctx,scale,this.attack,0,atk_alignX,stats_alignY);
        }

        if(this.cost!=0){
            i_costs.draw(ctx,scale,this.costXPos,this.costYPos,cost_alignX,1);
        }
        
        if(this.activated){
            const el=sigilElement(this.activated);
            el.width=i_act.dims[0]*scale;
            el.height=i_act.dims[1]*scale;
            el.style.left=act_alignX*scale+"px";
            el.style.top=act_alignY*scale+"px";
            el.classList.add("actSigil");
            el.style.setProperty("--scale",scale);
            
            i_act.draw(el.getContext("2d"),scale,this.activated.coords[0],this.activated.coords[1],0,0);
        }
        else{
            let alignX=this.visibleSigils.length==2? sig_alignX2: sig_alignX;
            for(let i=0; i<this.visibleSigils.length; i++){
                const tooltipEl=sigilElement(this.visibleSigils[i]);
                tooltipEl.width=i_sigils.dims[0]*scale;
                tooltipEl.height=i_sigils.dims[1]*scale;
                tooltipEl.style.left=alignX*scale+"px";
                tooltipEl.style.top=sig_alignY*scale+"px";
                
                i_sigils.draw(tooltipEl.getContext("2d"),scale,this.visibleSigils[i].coords[0],this.visibleSigils[i].coords[1],0,0);
                alignX+=i_sigils.dims[0]+1;
            }
        }

        d.appendChild(c);
        return {div: d,ctx,sigilEls};
    }

    render(scale){
        return this.renderAlsoReturnCtx(scale).div;
    }

    hasSigil(sig){
        for(let s of this.sigils){
            if(s==sig){
                return true;
            }
        }
        return false;
    }

    toJSON(){
        return this.jsonID;
    }
}

const s_bomb=new Sigil();
const s_digger=new Sigil();
const s_brittle=new Sigil();
const s_bifurcated=new Sigil();
const s_death_touch=new Sigil();
const s_double_death=new Sigil();
const s_fecundity=new Sigil();
const s_undying=new Sigil();
const s_ouroboros=new Sigil();
const s_sq_spawner=new SSpawner();
const s_rabbit=new Sigil();
const s_elk_fawn=new SFledgling();
const s_raven_egg=new SFledgling();
const s_sarc=new SFledgling();
const s_explosive=new Sigil();
const s_flying=new Sigil();
const s_energy=new Sigil();
const s_guardian=new Sigil();
const s_frozen_skele=new SFrozen();
const s_push=new Sigil();
const s_bones=new Sigil();
const s_reach=new Sigil();
const s_free_sac=new Sigil();
const s_quills=new Sigil();
const s_skele_spawner=new SSpawner();
const s_aquatic=new Sigil();
const s_worthy=new Sigil();
const s_trifurcated=new Sigil();
const s_tutor=new Sigil();
const s_burrow=new Sigil();
const s_sidestep=new SSpawner();
const s_sniper=new Sigil();
const s_blood_lust=new Sigil();
const s_dam=new Sigil();
const s_beehive=new Sigil();
const s_bells=new Sigil();
const s_extra_attack=new Sigil();
const s_cant_be_sacced=new Sigil();
const s_alpha=new BuffSigil();
const s_stinky=new BuffSigil();
const s_hand=new StatSigil();
const s_mirror=new StatSigil();

const c_squirrel=new Card();
const c_skeleton=new Card();
const c_hopper=new Card();
const c_adder=new Card();
const c_automaton=new Card();
const c_banshee=new Card();
const c_energy_bot=new Card();
const c_bloodhound=new Card();
const c_bolthound=new Card();
const c_explode_bot=new Card();
const c_mrs_bomb=new Card();
const c_bonehound=new Card();
const c_bullfrog=new Card();
const c_sniper=new Card();
const c_cat=new Card();
const c_coyote=new Card();
const c_pharaoh=new Card();
const c_draugr=new Card();
const c_drowned=new Card();
const c_elk=new Card();
const c_elk_fawn=new Card();
const c_family=new Card();
const c_mice=new Card();
const c_frank_stein=new Card();
const c_ghost_ship=new Card();
const c_gravedigger=new Card();
const c_grizzly=new Card();
const c_gunner=new Card();
const c_hawk=new Card();
const c_hrokkall=new Card();
const c_insectodrone=new Card();
const c_kingfisher=new Card();
const c_squirrel_ball=new Card();
const c_l33pbot=new Card();
const c_magpie=new Card();
const c_49er=new Card();
const c_mole=new Card();
const c_mole_man=new Card();
const c_steambot=new Card();
const c_mummy_lord=new Card();
const c_necromancer=new Card();
const c_ouroboros=new Card();
const c_rabbit=new Card();
const c_raven=new Card();
const c_revenant=new Card();
const c_stoat=new Card();
const c_steel_mice=new Card();
const c_salmon=new Card();
const c_sarcophagus=new Card();
const c_thicc=new Card();
const c_477=new Card();
const c_warren=new Card();
const c_wolf=new Card();
const c_zombie=new Card();
const c_cockroach=new Card();
const c_bat=new Card();
const c_beaver=new Card();
const c_dam=new Card();
const c_bee=new Card();
const c_beehive=new Card();
const c_black_goat=new Card();
const c_daus=new Card();
const c_bell=new Card();
const c_dire_wolf=new Card();
const c_rat_king=new Card();
const c_raven_egg=new Card();
const c_alpha=new Card();
const c_mantis=new Card();
const c_moose_buck=new Card();
const c_skunk=new Card();
const c_great_white=new Card();
const c_porcupine=new Card();
const c_rattler=new Card();
const c_river_snapper=new Card();
const c_sparrow=new Card();
const c_vulture=new Card();
const c_bone_horn=new Card();
const c_tomb_raider=new Card();
const c_plasma=new Card();
const c_bone_heap=new Card();
const c_mirror_tent=new Card();
const c_hand_tent=new Card();

const a_bone_horn=new VanillaActivated();
const a_disentomb=new VanillaActivated();
const a_energy_gun=new VanillaActivated();
const a_enlarge=new VanillaActivated();