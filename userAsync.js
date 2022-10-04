const common = require("./common");

const p_join_area = function (poolWrite, poolRead, Aerospike, client, vlr, configuration, io, data, socket) {
    try {
        console.log('[Start]:p_join_area:');
        // Todo code in here
        let userId = data.userId;
        let users = [];
        let areaCode = vlr.listUsers[userId].areaCode; // Lay area hien tai
        let taskCode = vlr.listUsers[userId].currentTaskCode;
        let actionCode = vlr.listUsers[userId].currentActionCode;
        // Lay thong tin cua Area gom: areaEnemies, areaGoogs, areaEvents,areaNPCs
        let areaEnemies = vlr.areaEnemies.type[0] != undefined ? vlr.areaEnemies.type[0][areaCode] : undefined; // Danh sach quai tren ban do
        let areaGoods = vlr.areaGoods.type[0] != undefined ? vlr.areaGoods.type[0][areaCode] : undefined;
        let areaEvents = vlr.areaEvents.type[0] != undefined ? vlr.areaEvents.type[0][areaCode] : undefined;
        let areaNPCs = vlr.areaNPCs.type[0] != undefined ? vlr.areaNPCs.type[0][areaCode] : undefined;
        // Lay thong tin cho task
        let taskEnemies = vlr.areaEnemies.type[1] != undefined && vlr.areaEnemies.type[1][taskCode] != undefined ? vlr.areaEnemies.type[1][taskCode][areaCode] : undefined;
        let taskGoods = vlr.areaGoods.type[1] != undefined && vlr.areaGoods.type[1][taskCode] != undefined ? vlr.areaGoods.type[1][taskCode][areaCode] : undefined;
        let taskEvents = vlr.areaEvents.type[1] != undefined && vlr.areaEvents.type[1][taskCode] != undefined ? vlr.areaEvents.type[1][taskCode][areaCode] : undefined;
        let taskNPCs = vlr.areaNPCs.typeFull[1] != undefined && vlr.areaNPCs.typeFull[1][taskCode] != undefined ? vlr.areaNPCs.typeFull[1][taskCode] : undefined;
        // Lay thong tin cho action
        let actionEnemies = vlr.areaEnemies.type[2] != undefined && vlr.areaEnemies.type[2][actionCode] != undefined ? vlr.areaEnemies.type[2][actionCode][areaCode] : undefined;
        let actionGoods = vlr.areaGoods.type[2] != undefined && vlr.areaGoods.type[2][actionCode] != undefined ? vlr.areaGoods.type[2][actionCode][areaCode] : undefined;
        let actionEvents = vlr.areaEvents.type[2] != undefined && vlr.areaEvents.type[2][actionCode] != undefined ? vlr.areaEvents.type[2][actionCode][areaCode] : undefined;
        let actionNPCs = vlr.areaNPCs.type[2] != undefined && vlr.areaNPCs.type[2][actionCode] != undefined ? vlr.areaNPCs.type[2][actionCode][areaCode] : undefined;

        //Check dead enemy
        //Khanh check 12/8
        let areaEnemiesAlive = areaEnemies != undefined ? JSON.parse(JSON.stringify(areaEnemies)) : {};
        let actionEnemiesAlive = actionEnemies != undefined ? JSON.parse(JSON.stringify(actionEnemies)) : {};
        let taskEnemiesAlive = taskEnemies != undefined ? JSON.parse(JSON.stringify(taskEnemies)) : {};
        let listEnemyDeadId = Object.keys(vlr.listEnemyDead);
        listEnemyDeadId.filter(id => {
            if(id.match(`^${userId}_`)) {
                return false
            } else {
                return true
            }
        }).forEach(id => {
            if(areaEnemiesAlive[id] != undefined) {
                delete areaEnemiesAlive[parseInt(id.split("_")[1])]
            } else if (taskEnemiesAlive[id] != undefined) {
                delete taskEnemiesAlive[parseInt(id.split("_")[1])]
            } else if (actionEnemiesAlive[id] != undefined) {
                delete actionEnemiesAlive[parseInt(id.split("_")[1])]
            }
        })
        //Xu ly task
        // Lay thong tin nguoi trong room
        // tao array nguoi dung
        //Todo: hôm trước sửa px py thành String để test
        let user = {
            userId: vlr.listUsers[userId].userId,
            hatCode: vlr.listUsers[userId].hatCode,
            wandCode: vlr.listUsers[userId].wandCode,
            outfitsCode: vlr.listUsers[userId].outfitsCode,
            bootCode: vlr.listUsers[userId].bootCode,
            ringCode: vlr.listUsers[userId].ringCode,
            createdAt: vlr.listUsers[userId].createdAt,
            px: vlr.listUsers[userId].px,
            py: vlr.listUsers[userId].py,
            name: vlr.listUsers[userId].name,
            grade: vlr.listUsers[userId].grade,
            gender: vlr.listUsers[userId].gender,
            language: vlr.listUsers[userId].language,
            hairStyle: vlr.listUsers[userId].hairStyle,
            hairColor: vlr.listUsers[userId].hairColor,
            skinColor: vlr.listUsers[userId].skinColor,
            lastLogin: vlr.listUsers[userId].lastLogin,
            exp: vlr.listUsers[userId].exp,
            level: vlr.listUsers[userId].level,
            currentTask: vlr.listUsers[userId].currentTask,
            currentAction: vlr.listUsers[userId].currentAction,
            areaCode: vlr.listUsers[userId].areaCode,
            specialGoods: vlr.listUsers[userId].mySpecialGoods,
            specialPets: vlr.listUsers[userId].mySpecialEnemies
        }

        let userPet;
        if (vlr.listUsers[userId].petId != undefined) {
            userPet = vlr.listUsers[userId].myPets[vlr.listUsers[userId].petId]
        }
        user.pet = userPet;
        let roomUsers = (vlr.areas != undefined) && (vlr.areas[areaCode] != undefined) ? vlr.areas[areaCode].listUsers : undefined;
        if (vlr.areas[vlr.listUsers[userId].areaCode].mapCode != 'house') {
            console.log('RoomUsers:', roomUsers);
            if (roomUsers != undefined) {
                let i;
                for (i in roomUsers) {
                    if (i == userId) {
                        // Da ton tai thong tin o day thi khong lam gi
                    } else {
                        //Todo: px py toString để test
                        let otherUser = {
                            userId: vlr.listUsers[i].userId,
                            hatCode: vlr.listUsers[i].hatCode,
                            wandCode: vlr.listUsers[i].wandCode,
                            outfitsCode: vlr.listUsers[i].outfitsCode,
                            bootCode: vlr.listUsers[i].bootCode,
                            ringCode: vlr.listUsers[i].ringCode,
                            createdAt: vlr.listUsers[i].createdAt,
                            px: vlr.listUsers[i].px,
                            py: vlr.listUsers[i].py,
                            name: vlr.listUsers[i].name,
                            grade: vlr.listUsers[i].grade,
                            gender: vlr.listUsers[i].gender,
                            language: vlr.listUsers[i].language,
                            hairStyle: vlr.listUsers[i].hairStyle,
                            hairColor: vlr.listUsers[i].hairColor,
                            skinColor: vlr.listUsers[i].skinColor,
                            lastLogin: vlr.listUsers[i].lastLogin,
                            exp: vlr.listUsers[i].exp,
                            level: vlr.listUsers[i].level
                        }

                        let pet;
                        if (vlr.listUsers[i].petId != undefined) {
                            pet = vlr.listUsers[i].myPets[vlr.listUsers[i].petId]

                        }
                        otherUser.pet = pet;
                        users.push(otherUser);
                        // Gui thong tin cho nguoi trong room bao co nguoi join
                        io.to(vlr.listUsers[i].socketid).emit('u_newuser_area', {
                            user: user
                        }
                        );
                    }
                }
            }
        }

        if (vlr.areas[areaCode].listUsers == undefined) {
            vlr.areas[areaCode].listUsers = {}
        }
        // Bo sung thon tin vao room
        vlr.areas[areaCode].listUsers[userId] = userId;
        // Gui thong tin cho nguoi join
        // Kiem tra map neu la house thi khong tra ve cai gi
        console.log('user.currentAction.actionType:', user.currentAction.actionType, ' user.currentAction.areaCode:', user.areaCode);
        let actionFinish = 0;
        if (user.currentAction.actionType == 2 || user.currentAction.actionType == 21 || user.currentAction.actionType == 19) {

            if (user.currentAction.areaCode == user.areaCode) {
                // Hoan thanh
                actionFinish = 1;
            }
        }
        if (actionFinish == 0) {
            io.to(vlr.listUsers[userId].socketid).emit('u_joined_area', {
                user: user,
                listUsers: users,
                areaEnemies: areaEnemiesAlive,
                areaGoods: areaGoods != undefined ? Object.keys(areaGoods).map((key) => areaGoods[key]) : [],
                areaEvents: areaEvents != undefined ? Object.keys(areaEvents).map((key) => areaEvents[key]) : [],
                areaNPCs: areaNPCs != undefined ? Object.keys(areaNPCs).map((key) => areaNPCs[key]) : [],
                taskEnemies: taskEnemiesAlive,
                taskGoods: taskGoods != undefined ? Object.keys(taskGoods).map((key) => taskGoods[key]) : [],
                taskEvents: taskEvents != undefined ? Object.keys(taskEvents).map((key) => taskEvents[key]) : [],
                taskNPCs: taskNPCs != undefined ? Object.keys(taskNPCs).map((key) => taskNPCs[key]) : [],
                actionEnemies: actionEnemiesAlive,
                actionGoods: actionGoods != undefined ? Object.keys(actionGoods).map((key) => actionGoods[key]) : [],
                actionEvents: actionEvents != undefined ? Object.keys(actionEvents).map((key) => actionEvents[key]) : [],
                actionNPCs: actionNPCs != undefined ? Object.keys(actionNPCs).map((key) => actionNPCs[key]) : []
            });
        } else {
            common.updateActionStatus(vlr, userId, poolWrite).then(data => {
                // Cap nhat lai du lieu cho user
                vlr.listUsers[userId].currentActionCode = data.nextActionCode;
                vlr.listUsers[userId].currentTaskCode = data.nextTaskCode;
                delete vlr.listUsers[userId].currentAction;
                vlr.listUsers[userId].currentAction = vlr.actions.full[data.nextActionCode];
                delete vlr.listUsers[userId].currentTask;
                vlr.listUsers[userId].currentTask = vlr.tasks[data.nextTaskCode];
                delete user.currentAction;
                user.currentAction = vlr.actions.full[data.nextActionCode];
                delete user.currentTask;
                user.currentTask = vlr.tasks[data.nextTaskCode];

                // Cap nhat db
                let sql = 'update student set current_task_code = $1, current_action_code = $2 where id = $3';
                poolWrite.query(sql, [data.nextTaskCode, data.nextActionCode, userId]);
                // Send to client

                if (user.currentAction.actionType == 18) {
                    common.checkActionLevelUp(vlr, userId, poolWrite).then(dataLevel => {
                    }).catch(errorLevel => {
                        console.log("Loi trong qua trinh update:", errorLevel);
                    })
                }

                let prizeData = {
                    user: user,
                    listUsers: users,
                    areaEnemies: areaEnemies,
                    areaGoods: areaGoods != undefined ? Object.keys(areaGoods).map((key) => areaGoods[key]) : [],
                    areaEvents: areaEvents != undefined ? Object.keys(areaEvents).map((key) => areaEvents[key]) : [],
                    areaNPCs: areaNPCs != undefined ? Object.keys(areaNPCs).map((key) => areaNPCs[key]) : [],
                    taskEnemies: taskEnemies,
                    taskGoods: data.taskGoods != undefined ? data.taskGoods : [],
                    taskEvents: data.taskEvents != undefined ? data.taskEvents : [],
                    taskNPCs: data.taskNPCs != undefined ? data.taskNPCs : [],
                    actionEnemies: actionEnemies,
                    actionGoods: data.actionGoods != undefined ? data.actionGoods : [],
                    actionEvents: data.actionEvents != undefined ? data.actionEvents : [],
                    actionNPCs: data.actionNPCs != undefined ? data.actionNPCs : [],
                    Status: data.status
                }
                if (data.prize != null && data.prize != undefined && Object.keys(data.prize).length > 0) {
                    prizeData.prize = data.prize
                }
                io.to(vlr.listUsers[userId].socketid).emit('u_joined_area', prizeData);

            }).catch(error => {
                console.log("Loi trong qua trinh update:", error);
            })

        }

    } catch (e) {
        console.log('[Error]:p_join_world:', e);
    }

}
const p_position = function (poolWrite, poolRead, Aerospike, client, vlr, configuration, io, data, socket) {
    try {
        console.log('[Start]:p_position:', data);
        // Cap nhat thong tin cho user
        let userId = data.userId;
        let user = vlr.listUsers[userId]
        let areaCode = user.areaCode; // Lay area hien tai
        user.px = data.px;
        user.py = data.py;
        // Thong bao cho cac user biet la thang nay no thay doi position

        let roomUsers = vlr.areas[areaCode].listUsers;
        if (roomUsers != undefined) {
            let i;
            for (i in roomUsers) {
                if (i == userId) {
                    // Da ton tai thong tin o day thi khong lam gi
                } else {
                    // Gui thong bao di chuyen
                    io.to(vlr.listUsers[i].socketid).emit('u_position', { userId: userId, px: data.px, py: data.py });
                }
            }
        }
    } catch (e) {
        console.log('[Error]:p_position:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }

}
const p_chat = function (poolWrite, poolRead, Aerospike, client, vlr, configuration, io, data, socket) {
    try {
        console.log('[Start]:p_chat:');
        // Todo code in here
        let userId = data.userId;
        let user = vlr.listUsers[userId]
        let areaCode = user.areaCode; // Lay area hien tai
        // Thong bao cho cac user biet la thang nay no thay doi position
        let roomUsers = vlr.areas[areaCode].listUsers;
        if (roomUsers != undefined || roomUsers.lenth > 0) {
            let i;
            for (i in roomUsers) {
                if (i == userId) {
                    // Da ton tai thong tin o day thi khong lam gi
                } else {
                    // Gui thong bao di chuyen
                    io.to(vlr.listUsers[i].socketid).emit('u_chat', { userId: userId, msg: data.msg });
                }
            }
        }

    } catch (e) {
        console.log('[Error]:p_chat:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }

}
const p_change_area = function (poolWrite, poolRead, Aerospike, client, vlr, configuration, io, data, socket) {
    try {
        console.log('[Start]:p_change_area:', data);
        // Todo: Tinh new position
        // Todo code in here
        let userId = data.userId;
        let users = [];
        let user = vlr.listUsers[userId]
        let oldAreaCode = user.areaCode; // Lay area hien tai
        let areaCode = data.areaCode;
        let oldArea = vlr.areas[oldAreaCode];
        let newArea = vlr.areas[areaCode];
        if (oldAreaCode == areaCode) {
            // Do nothing
        } else {
            let user = {
                userId: vlr.listUsers[userId].userId,
                hatCode: vlr.listUsers[userId].hatCode,
                wandCode: vlr.listUsers[userId].wandCode,
                outfitsCode: vlr.listUsers[userId].outfitsCode,
                bootCode: vlr.listUsers[userId].bootCode,
                ringCode: vlr.listUsers[userId].ringCode,
                createdAt: vlr.listUsers[userId].createdAt,
                px: vlr.listUsers[userId].px,
                py: vlr.listUsers[userId].py,
                name: vlr.listUsers[userId].name,
                grade: vlr.listUsers[userId].grade,
                gender: vlr.listUsers[userId].gender,
                language: vlr.listUsers[userId].language,
                hairStyle: vlr.listUsers[userId].hairStyle,
                hairColor: vlr.listUsers[userId].hairColor,
                skinColor: vlr.listUsers[userId].skinColor,
                lastLogin: vlr.listUsers[userId].lastLogin,
                exp: vlr.listUsers[userId].exp,
                level: vlr.listUsers[userId].level
            }
            let userPet;
            if (vlr.listUsers[userId].petId != undefined) {
                userPet = vlr.listUsers[userId].myPets[vlr.listUsers[userId].petId]

            }
            user.pet = userPet;

            // Thuc hien remove area cu
            if (vlr.areas[oldAreaCode].listUsers != undefined) {
                delete vlr.areas[oldAreaCode].listUsers[userId]; // Xoa thang cu
                if (oldArea.mapCode != 'house') {
                    let i;
                    for (i in vlr.areas[oldAreaCode].listUsers) {
                        // Gui thong bao di chuyen
                        io.to(vlr.listUsers[i].socketid).emit('u_user_remove', { userId: userId });
                    }
                }
            }
            // Thuc hien join vao newArea
            let taskCode = vlr.listUsers[userId].currentTaskCode;
            let actionCode = vlr.listUsers[userId].currentActionCode;
            // Lay thong tin cua Area gom: areaEnemies, areaGoogs, areaEvents,areaNPCs
            let areaEnemies = vlr.areaEnemies.type[0] != undefined ? vlr.areaEnemies.type[0][areaCode] : {}; // Danh sach quai tren ban do
            let areaGoods = vlr.areaGoods.type[0] != undefined ? vlr.areaGoods.type[0][areaCode] : {};
            let areaEvents = vlr.areaEvents.type[0] != undefined ? vlr.areaEvents.type[0][areaCode] : {};
            let areaNPCs = vlr.areaNPCs.type[0] != undefined ? vlr.areaNPCs.type[0][areaCode] : {};
            // Lay thong tin cho task
            let taskEnemies = vlr.areaEnemies.type[1] != undefined && vlr.areaEnemies.type[1][taskCode] != undefined ? vlr.areaEnemies.type[1][taskCode][areaCode] : {};
            let taskGoods = vlr.areaGoods.type[1] != undefined && vlr.areaGoods.type[1][taskCode] != undefined ? vlr.areaGoods.type[1][taskCode][areaCode] : {};
            let taskEvents = vlr.areaEvents.type[1] != undefined && vlr.areaEvents.type[1][taskCode] != undefined ? vlr.areaEvents.type[1][taskCode][areaCode] : {};
            let taskNPCs = vlr.areaNPCs.type[1] != undefined && vlr.areaNPCs.type[1][taskCode] != undefined ? vlr.areaNPCs.type[1][taskCode][areaCode] : {};
            // Lay thong tin cho action
            let actionEnemies = vlr.areaEnemies.type[2] != undefined && vlr.areaEnemies.type[2][actionCode] != undefined ? vlr.areaEnemies.type[2][actionCode][areaCode] : {};
            let actionGoods = vlr.areaGoods.type[2] != undefined && vlr.areaGoods.type[2][actionCode] != undefined ? vlr.areaGoods.type[2][actionCode][areaCode] : {};
            let actionEvents = vlr.areaEvents.type[2] != undefined && vlr.areaEvents.type[2][actionCode] != undefined ? vlr.areaEvents.type[2][actionCode][areaCode] : {};
            let actionNPCs = vlr.areaNPCs.type[2] != undefined && vlr.areaNPCs.type[2][actionCode] != undefined ? vlr.areaNPCs.type[2][actionCode][areaCode] : {};

            //Check dead enemy

            // let areaEnemiesAlive = [];
            // let areaEnemy;
            // for (areaEnemy in areaEnemies) {
            //     let enemy = areaEnemies[areaEnemy];
            //     if (vlr.listEnemyDead[userId + "_" + enemy.enemyId] == undefined || vlr.listEnemyDead[userId + "_" + enemy.enemyId].areaCode != areaCode) {
            //         areaEnemiesAlive.push(enemy)
            //     }
            // };

            let roomUsers
            if (vlr.areas[areaCode] != undefined) {
                roomUsers = vlr.areas[areaCode].listUsers;
            }
            // Cập nhật vị trí x & y
            let checkPoint;
            let listCheckPoints = vlr.checkPoints[newArea.mapCode][newArea.code];
            // Tim kiem checkPoint
            if (listCheckPoints == undefined) {
                console.log('listCheckPoints: Loi khong lay duoc list check point');
                return;
            }
            let k;
            let checkPointDefault0;
            let checkPointDefault1;
            for (k in listCheckPoints) {
                if (listCheckPoints[k].oldMapCode == 'default' && listCheckPoints[k].oldArea == 'default') {
                    checkPointDefault0 = listCheckPoints[k];
                }
                if (listCheckPoints[k].oldMapCode == oldArea.mapCode && listCheckPoints[k].oldArea == 'default') {
                    checkPointDefault1 = listCheckPoints[k];
                }
                if (listCheckPoints[k].oldMapCode == oldArea.mapCode && listCheckPoints[k].newMapCode == newArea.mapCode && listCheckPoints[k].oldArea == oldArea.code && listCheckPoints[k].newArea == newArea.code) {
                    checkPoint = listCheckPoints[k];
                }
            }
            if (checkPoint == undefined) {
                checkPoint = checkPointDefault1;
            }
            if (checkPoint == undefined) {
                checkPoint = checkPointDefault0;
            }
            if (checkPoint == undefined) {
                console.log('Chua khai bao checkpoint: oldArea:', oldArea, 'New Area:', newArea, 'listCheckPoints:', listCheckPoints, 'checkPoint:', checkPoint, 'checkPointDefault1:', checkPointDefault1, "checkPointDefault0:", checkPointDefault1);
                return;
            }
            user.px = parseFloat(checkPoint.px);
            user.py = parseFloat(checkPoint.py);
            user.areaCode = newArea.areaCode;
            // Cap nhat vi tri vao CSDL
            let sql = 'update student set area_code = $1, p_x = $2, p_y = $3 where id = $4';
            poolWrite.query(sql, [user.areaCode, user.px, user.py, user.userId]);

            if (newArea.mapCode != 'house') {
                if (roomUsers != undefined) {
                    let i;
                    for (i in roomUsers) {
                        if (i == userId) {
                            // Da ton tai thong tin o day thi khong lam gi
                        } else {
                            let otherUser = {
                                userId: vlr.listUsers[i].userId,
                                hatCode: vlr.listUsers[i].hatCode,
                                wandCode: vlr.listUsers[i].wandCode,
                                outfitsCode: vlr.listUsers[i].outfitsCode,
                                bootCode: vlr.listUsers[i].bootCode,
                                ringCode: vlr.listUsers[i].ringCode,
                                createdAt: vlr.listUsers[i].createdAt,
                                px: vlr.listUsers[i].px,
                                py: vlr.listUsers[i].py,
                                name: vlr.listUsers[i].name,
                                grade: vlr.listUsers[i].grade,
                                gender: vlr.listUsers[i].gender,
                                language: vlr.listUsers[i].language,
                                hairStyle: vlr.listUsers[i].hairStyle,
                                hairColor: vlr.listUsers[i].hairColor,
                                skinColor: vlr.listUsers[i].skinColor,
                                lastLogin: vlr.listUsers[i].lastLogin,
                                exp: vlr.listUsers[i].exp,
                                level: vlr.listUsers[i].level
                            }
                            let pet;
                            if (vlr.listUsers[i].petId != undefined) {
                                pet = vlr.listUsers[i].myPets[vlr.listUsers[i].petId]

                            }
                            otherUser.pet = pet;
                            users.push(otherUser);
                            // Gui thong tin cho nguoi trong room bao co nguoi join
                            io.to(vlr.listUsers[i].socketid).emit('u_newuser_area', {
                                user: user
                            }
                            );
                        }
                    }
                }

            }
            if (vlr.areas[areaCode].listUsers == undefined) {
                vlr.areas[areaCode].listUsers = {}
            }
            // Bo sung thon tin vao room
            vlr.areas[areaCode].listUsers[userId] = userId;
            // Gui thong tin cho nguoi join
            io.to(vlr.listUsers[userId].socketid).emit('u_joined_area', {
                user: user,
                listUsers: users,
                areaEnemies: areaEnemies,
                areaGoods: areaGoods != undefined ? Object.keys(areaGoods).map((key) => [key, areaGoods[key]]) : [],
                areaEvents: areaEvents != undefined ? Object.keys(areaEvents).map((key) => [key, areaEvents[key]]) : [],
                areaNPCs: areaNPCs != undefined ? Object.keys(areaNPCs).map((key) => [key, areaNPCs[key]]) : [],
                taskEnemies: taskEnemies != undefined ? Object.keys(taskEnemies).map((key) => [key, taskEnemies[key]]) : [],
                taskGoods: taskGoods != undefined ? Object.keys(taskGoods).map((key) => [key, taskGoods[key]]) : [],
                taskEvents: taskEvents != undefined ? Object.keys(taskEvents).map((key) => [key, taskEvents[key]]) : [],
                taskNPCs: taskNPCs != undefined ? Object.keys(taskNPCs).map((key) => [key, taskNPCs[key]]) : [],
                actionEnemies: actionEnemies != undefined ? Object.keys(actionEnemies).map((key) => [key, actionEnemies[key]]) : [],
                actionGoods: actionGoods != undefined ? Object.keys(actionGoods).map((key) => [key, actionGoods[key]]) : [],
                actionEvents: actionEvents != undefined ? Object.keys(actionEvents).map((key) => [key, actionEvents[key]]) : [],
                actionNPCs: actionNPCs != undefined ? Object.keys(actionNPCs).map((key) => [key, actionNPCs[key]]) : []
            });
        }
    } catch (e) {
        console.log('[Error]:p_change_area:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }

}

const p_listenned = function (poolWrite, poolRead, Aerospike, client, vlr, configuration, io, data, socket) {
    try {
        console.log("p_listenned");
        //Todo
    } catch (e) {
        console.log("p_listenned", e)
    }
};
const p_talked = function (poolWrite, poolRead, Aerospike, client, vlr, configuration, io, data, socket) {
    try {
        console.log("p_talked");
        //Todo
    } catch (e) {
        console.log("p_talked", e)
    }
};
const p_returned_enemy = function (poolWrite, poolRead, Aerospike, client, vlr, configuration, io, data, socket) {
    try {
        console.log("p_returned_enemy");
        //Todo
    } catch (e) {
        console.log("p_returned_enemy", e)
    }
};
const p_picked_goods = function (poolWrite, poolRead, Aerospike, client, vlr, configuration, io, data, socket) {
    try {
        console.log("p_picked_goods");
        //Todo
    } catch (e) {
        console.log("p_picked_goods", e)
    }
};
const p_returned_goods = function (poolWrite, poolRead, Aerospike, client, vlr, configuration, io, data, socket) {
    try {
        console.log("p_returned_goods");
        //Todo
    } catch (e) {
        console.log("p_returned_goods", e)
    }
};
const p_got_enemy = function (poolWrite, poolRead, Aerospike, client, vlr, configuration, io, data, socket) {
    try {
        console.log("p_got_enemy");
        //Todo
    } catch (e) {
        console.log("p_got_enemy", e)
    }
};
const p_put_out_fire = function (poolWrite, poolRead, Aerospike, client, vlr, configuration, io, data, socket) {
    try {
        console.log("p_put_out_fire");
        //Todo
    } catch (e) {
        console.log("p_put_out_fire", e)
    }
};
const p_returned_forest = function (poolWrite, poolRead, Aerospike, client, vlr, configuration, io, data, socket) {
    try {
        console.log("p_returned_forest");
        //Todo
    } catch (e) {
        console.log("p_returned_forest", e)
    }
};
const p_flute = function (poolWrite, poolRead, Aerospike, client, vlr, configuration, io, data, socket) {
    try {
        console.log("p_flute");
        //Todo
    } catch (e) {
        console.log("p_flute", e)
    }
};
const p_returned_stone = function (poolWrite, poolRead, Aerospike, client, vlr, configuration, io, data, socket) {
    try {
        console.log("p_returned_stone");
        //Todo
    } catch (e) {
        console.log("p_returned_stone", e)
    }
};
const p_followed = function (poolWrite, poolRead, Aerospike, client, vlr, configuration, io, data, socket) {
    try {
        console.log("p_followed");
        //Todo
    } catch (e) {
        console.log("p_followed", e)
    }
};
const p_npc_talked = function (poolWrite, poolRead, Aerospike, client, vlr, configuration, io, data, socket) {
    try {
        console.log("p_npc_talked");
        //Todo
    } catch (e) {
        console.log("p_npc_talked", e)
    }
};
const p_area_auto_changed = function (poolWrite, poolRead, Aerospike, client, vlr, configuration, io, data, socket) {
    try {
        console.log("p_area_auto_changed");
        //Todo
    } catch (e) {
        console.log("p_area_auto_changed", e)
    }
};


const p_skill_code_human = function (poolWrite, poolRead, Aerospike, client, vlr, configuration, io, data, socket) {
    try {
        console.log("p_skill_code_human");
        let battleId = data.battleId;
        let userId = data.userId;
        let skillCode = data.skillCode; // Phai lay danh sach skill cho nguoi dung chon
        let attackerId = data.attackerId;
        // Kiem tra danh sach nguoi choi co duoc choi khong
        let itemCode = data.itemCode;  // Lay item ma nguoi dun su dung
        if (battleId == undefined) {
            // Khong lam gi het du lieu sai
            return;
        }
        let battle = vlr.listHumanBattles[battleId];
        if (battle == undefined) {
            // Khong lam gi het
            return;
        }
        // Refresh battle
        battle.refreshTime = Date.now();

        let team = vlr.listHumanBattles[battleId].team[userId];
        if (team == undefined) {
            console.log('p_skill_code_human: Khong tim duoc team')
            return;
        }
        console.log('Team:', team);
        // Kiem tra xem attackerId co ton tai khong ? skillCode co okay khong 
        if (team.listMembers[attackerId] == undefined) {
            console.log('p_skill_code_human:Nguoi danh khong dung')
            return;
        }

        let i;
        let skillOkay = false;
        for (i = 0; i < team.listMembers[attackerId].listSkill.length; i++) {
            if (team.listMembers[attackerId].listSkill[i].code == skillCode) {
                skillOkay = true;
            }
        }
        if (skillOkay == false) {
            console.log('p_skill_code_human:Khong tim duoc skill da chon')
            return;
        }
        if (battle.currentTurn == undefined) {
            battle.currentTurn = 1;
        }
        let currentTurn = battle.currentTurn;
        if (battle.turn == undefined) {
            battle.turn = {}
        }
        if (battle.turn[currentTurn] == undefined) {
            // turn chua duoc tao
            // Tao turn
            let newTurn = {
                id: currentTurn
            }
            let attacker = {
                userId: userId,
                skillCode: skillCode,
                attackerId: attackerId
            }
            if (itemCode != undefined && vlr.listUsers[userId].myGoods != undefined && vlr.listUsers[userId].myGoods[itemCode] != undefined && vlr.listUsers[userId].myGoods[itemCode].use == 1) { // Neu item duoc dung
                attacker.itemCode = itemCode;
            }
            newTurn[attacker.userId] = attacker
            // Gui cau hoi cho nguoi nay
            battle.turn[currentTurn] = newTurn;
        } else {
            // Turn da duoc tao thuc hien tinh toan de danh
            let attacker = {
                userId: userId,
                skillCode: skillCode,
                attackerId: attackerId
            }
            if (itemCode != undefined && vlr.listUsers[userId].myGoods != undefined && vlr.listUsers[userId].myGoods[itemCode] != undefined && vlr.listUsers[userId].myGoods[itemCode].use == 1) { // Neu item duoc dung
                attacker.itemCode = itemCode;
            }
            battle.turn[currentTurn][attacker.userId] = attacker
        }
        team.attackerId = attackerId; // Cap nhat nguoi danh
        // Gui lai cau hoi cho nguoi nay
        let user = vlr.listUsers[userId];
        let currentQuestion = user.currentQuestion;
        console.log('p_skill_code_human: gui thong tin question')
        io.to(user.socketid).emit('u_question', { userId: userId, question: currentQuestion });
    } catch (e) {
        console.log("p_skill_code_human", e)
    }
};
const p_result_human = function (poolWrite, poolRead, Aerospike, client, vlr, configuration, io, data, socket) {
    try {
        console.log("p_result_human");
        let battleId = data.battleId;
        let result = data.result;
        let userId = data.userId;
        if (battleId == undefined) {
            // Khong lam gi het du lieu sai
            return;
        }
        let battle = vlr.listHumanBattles[battleId];
        if (battle == undefined) {
            // Khong lam gi het
            return;
        }

        if (result == undefined) {
            return;
        }
        // Refresh battle
        battle.refreshTime = Date.now();
        console.log("p_result_human");
        let user = vlr.listUsers[userId];
        // Lay trang thai cua turn
        let turn = battle.turn[battle.currentTurn];// Lay doi tuong turn
        if (turn.status == undefined) {
            turn.status = 0;
        } else {
            turn.status = turn.status + 1;
        }
        let attacker = turn[userId];
        attacker.result = result;
        // Lay team
        let team1 = battle.team[userId];
        if (attacker.result.result == 0) {// tra loi sai nen bi mat 
            team1.lostTurn = team1.lostTurn + 1;
        }
        if (turn.status == 1) {
            // Ca hai da tra loi. Thuc hien tinh toan de tra lai cho nguoi dung
            let team2;
            let i;
            for (i in vlr.listHumanBattles[battleId].team) {
                if (i != userId) {
                    team2 = vlr.listHumanBattles[battleId].team[i];
                }
            }
            // Lay team moi 1
            let newTeam1 = common.getNewAttackerTeam(vlr, battleId, team1.userId, poolWrite);
            // Lay team moi 2
            let newTeam2 = common.getNewAttackerTeam(vlr, battleId, team2.userId, poolWrite);
            vlr.listUsers[newTeam1.userId].mana = newTeam1.mana; // Cap nhat mana
            vlr.listUsers[newTeam2.userId].mana = newTeam2.mana; // Cap nhat mana
            io.to(vlr.listUsers[newTeam1.userId].socketid).emit('u_turn_human', { userId: newTeam1.userId, myTeam: newTeam1, otherTeam: newTeam2 });
            io.to(vlr.listUsers[newTeam2.userId].socketid).emit('u_turn_human', { userId: newTeam2.userId, myTeam: newTeam2, otherTeam: newTeam1 });
            // Xoa du lieu cu
            if (battle.team[newTeam1.userId] != undefined) {
                delete battle.team[newTeam1.userId];
                battle.team[newTeam1.userId] = newTeam1;
            }
            if (battle.team[newTeam2.userId] != undefined) {
                delete battle.team[newTeam2.userId];
                battle.team[newTeam2.userId] = newTeam2;
            }
            // Update du lieu moi
        }
        common.submitQuestion(userId, configuration, result).then(data => {
            if (data != undefined) {
                delete user.currentQuestion;
                user.currentQuestion = data;
                io.to(vlr.listUsers[userId].socketid).emit('u_update_question', { userId: userId, currentQuestion: user.currentQuestion });

            }
        }).catch(error => {
            console.log('Loi khi submit cau tra loi:', error);
        })
    } catch (e) {
        console.log("p_result_human", e)
    }
};
const p_turn_done_human = function (poolWrite, poolRead, Aerospike, client, vlr, configuration, io, data, socket) {
    try {
        console.log("p_turn_done_human");
        let battleId = data.battleId;
        let userId = data.userId;
        if (battleId == undefined) {
            // Khong lam gi het du lieu sai
            console.log('p_turn_done_human: BattleId null');
            return;
        }
        let battle = vlr.listHumanBattles[battleId];
        if (battle == undefined) {
            // Khong lam gi het
            console.log('p_turn_done_human: Battle null');
            return;
        }
        // Refresh battle
        battle.refreshTime = Date.now();
        console.log("p_turn_done_human: Update time");
        let user = vlr.listUsers[userId];
        // Lay trang thai cua turn
        let turn = battle.turn[battle.currentTurn];// Lay doi tuong turn

        if (turn.status == undefined) {
            turn.status = 0;
        }

        turn.status = turn.status + 1;

        if (turn.doneHuman == undefined) {
            turn.doneHuman = {}
        }
        turn.doneHuman[userId] = userId;
        if (turn.status >= 3) {
            // Cuoc chien da ket thuc hay chua
            let i;
            let team1 = battle.team[userId]; // Lay team so 1
            let team2;
            for (i in vlr.listHumanBattles[battleId].team) {
                if (i != userId) {
                    team2 = vlr.listHumanBattles[battleId].team[i];
                }
            }
            if (team1.currentHealth == 0) {
                // Team 1 da thua
                //u_human_lost
                console.log('p_turn_done_human: Team 1 thua');
                io.to(vlr.listUsers[team1.userId].socketid).emit('u_human_lost', { battleId: battleId, userId: team1.userId, team1: team1, otherTeam: team2 });
                if (team2.currentHealth == 0) {
                    console.log('p_turn_done_human: Team 2 thua');
                    // Team 2 thua, team 1 thua
                    io.to(vlr.listUsers[team2.userId].socketid).emit('u_human_won', { battleId: battleId, userId: team2.userId, myTeam: team2, otherTeam: team1 });
                    // Xoa tran dau xoa thong tin tran dau o 2 thang
                    delete vlr.listHumanBattles[battleId];
                    delete vlr.listUsers[team1.userId].humanBattleId;
                    delete vlr.listUsers[team2.userId].humanBattleId;

                    //Todo ket thuc tran dau
                } else {
                    // Team  2 thang
                    // Team 1 thua
                    // Phan thuong cho team 2. Xoa tran chien, xoa thong tin tran chien o 2 thang
                    common.getPrizeEnemyWon(vlr, poolWrite, team2).then(dataPrize => {
                        //Xoa thong tin tran
                        delete vlr.listHumanBattles[battleId];
                        delete vlr.listUsers[team1.userId].humanBattleId;
                        delete vlr.listUsers[team2.userId].humanBattleId;


                        console.log('p_turn_done_human: Team 2 thang');
                        // Todo ket thuc tran dau
                        io.to(vlr.listUsers[team2.userId].socketid).emit('u_human_won', { battleId: battleId, userId: team2.userId, myTeam: team2, otherTeam: team1, prize: dataPrize.prize, expEachMemberWin: dataPrize.expEachMember, enemyLevelUpWin: dataPrize.enemyLevelUp });
                    })
                        .catch(error =>
                            console.log('prize error', error)
                        )
                }

            } else {
                // Team 1 chua thua
                // Todo ket thuc tran dau
                if (team2.currentHealth == 0) {
                    // Team 2 thua
                    // Team 1 thang
                    // Phan thuong cho team 1
                    common.getPrizeEnemyWon(vlr, poolWrite, team1).then(dataPrize => {
                        //Xoa thong tin tran
                        delete vlr.listHumanBattles[battleId];
                        delete vlr.listUsers[team1.userId].humanBattleId;
                        delete vlr.listUsers[team2.userId].humanBattleId;

                        // Xoa thong tin
                        console.log('p_turn_done_human: Team 2 thua, Team 1 thang');
                        io.to(vlr.listUsers[team2.userId].socketid).emit('u_human_lost', { battleId: battleId, userId: team2.userId });
                        io.to(vlr.listUsers[team1.userId].socketid).emit('u_human_won', { battleId: battleId, userId: team1.userId, prize: dataPrize.prize, expEachMemberWin: dataPrize.expEachMember, enemyLevelUpWin: dataPrize.enemyLevelUp });
                    })
                        .catch(error =>
                            console.log('prize error', error)
                        )
                } else {
                    // Van danh tiep
                    let user1 = {
                        userId: vlr.listUsers[team1.userId].userId,
                        hatCode: vlr.listUsers[team1.userId].hatCode,
                        wandCode: vlr.listUsers[team1.userId].wandCode,
                        outfitsCode: vlr.listUsers[team1.userId].outfitsCode,
                        bootCode: vlr.listUsers[team1.userId].bootCode,
                        ringCode: vlr.listUsers[team1.userId].ringCode,
                        createdAt: vlr.listUsers[team1.userId].createdAt,
                        px: vlr.listUsers[team1.userId].px,
                        py: vlr.listUsers[team1.userId].py,
                        name: vlr.listUsers[team1.userId].name,
                        grade: vlr.listUsers[team1.userId].grade,
                        gender: vlr.listUsers[team1.userId].gender,
                        language: vlr.listUsers[team1.userId].language,
                        hairStyle: vlr.listUsers[team1.userId].hairStyle,
                        hairColor: vlr.listUsers[team1.userId].hairColor,
                        skinColor: vlr.listUsers[team1.userId].skinColor,
                        lastLogin: vlr.listUsers[team1.userId].lastLogin,
                        exp: vlr.listUsers[team1.userId].exp,
                        level: vlr.listUsers[team1.userId].level,
                        mana: vlr.listUsers[team1.userId].mana,
                        petId: vlr.listUsers[team1.userId].petId
                    }
                    let user1Items = []; // Lay danh sach item
                    for (i in vlr.listUsers[team1.userId].myGoods) {
                        let y = vlr.listUsers[team1.userId].myGoods[i];
                        if (y.use == 1) {
                            user1Items.push(y)
                        }

                    }
                    user1.items = user1Items;
                    let user2 = {
                        userId: vlr.listUsers[team2.userId].userId,
                        hatCode: vlr.listUsers[team2.userId].hatCode,
                        wandCode: vlr.listUsers[team2.userId].wandCode,
                        outfitsCode: vlr.listUsers[team2.userId].outfitsCode,
                        bootCode: vlr.listUsers[team2.userId].bootCode,
                        ringCode: vlr.listUsers[team2.userId].ringCode,
                        createdAt: vlr.listUsers[team2.userId].createdAt,
                        px: vlr.listUsers[team2.userId].px,
                        py: vlr.listUsers[team2.userId].py,
                        name: vlr.listUsers[team2.userId].name,
                        grade: vlr.listUsers[team2.userId].grade,
                        gender: vlr.listUsers[team2.userId].gender,
                        language: vlr.listUsers[team2.userId].language,
                        hairStyle: vlr.listUsers[team2.userId].hairStyle,
                        hairColor: vlr.listUsers[team2.userId].hairColor,
                        skinColor: vlr.listUsers[team2.userId].skinColor,
                        lastLogin: vlr.listUsers[team2.userId].lastLogin,
                        exp: vlr.listUsers[team2.userId].exp,
                        level: vlr.listUsers[team2.userId].level,
                        mana: vlr.listUsers[team2.userId].mana,
                        petId: vlr.listUsers[team2.userId].petId
                    }
                    let user2Items = []; // Lay danh sach item
                    for (i in vlr.listUsers[team2.userId].myGoods) {
                        let y = vlr.listUsers[team2.userId].myGoods[i];
                        if (y.use == 1) {
                            user2Items.push(y)
                        }
                    }
                    user2.items = user2Items;
                    io.to(vlr.listUsers[team1.userId].socketid).emit('u_turn_human_next', { battleId: battleId, myInfo: user1, myTeam: team1, otherTeam: team2 });
                    io.to(vlr.listUsers[team2.userId].socketid).emit('u_turn_human_next', { battleId: battleId, myInfo: user2, myTeam: team2, otherTeam: team1 });
                    battle.currentTurn = battle.currentTurn + 1;
                }
            }
        }
        //Todo
    } catch (e) {
        console.log("p_turn_done_human", e)
    }
};

const p_skill_code_enemy = function (poolWrite, poolRead, Aerospike, client, vlr, configuration, io, data, socket) {
    try {
        // Kiem tra turn
        console.log("p_skill_code_ennemy:", data);
        let battleId = data.battleId;
        let userId = data.userId;
        let skillCode = data.skillCode; // Phai lay danh sach skill cho nguoi dung chon
        let attackerId = data.attackerId;
        // Kiem tra danh sach nguoi choi co duoc choi khong
        let itemCode = data.itemCode;  // Lay item ma nguoi dun su dung
        if (battleId == undefined) {
            // Khong lam gi het du lieu sai
            console.log('BattleId null');
            return;
        }
        let battle = vlr.listEnemyBattles[battleId];
        if (battle == undefined) {
            // Khong lam gi het
            console.log('Battle null');
            return;
        }
        // Refresh battle
        battle.refreshTime = Date.now();
        let enemyTeam = vlr.listEnemyBattles[battleId].enemyTeam;
        let humanTeam = vlr.listEnemyBattles[battleId].humanTeam;
        if (humanTeam == undefined) {
            console.log('humanTeam null');
            return;
        }
        // Kiem tra xem attackerId co ton tai khong ? skillCode co okay khong 
        if (humanTeam.listMembers[attackerId] == undefined) {
            console.log('Member null');
            return;
        }
        // Kiem tra thong tin ve turn
        let i;
        let skillOkay = false;
        for (i = 0; i < humanTeam.listMembers[attackerId].listSkill.length; i++) {
            if (humanTeam.listMembers[attackerId].listSkill[i].code == skillCode) {
                skillOkay = true;
            }
        }
        if (skillOkay == false) {
            console.log('SkillCode null');
            return;
        }
        if (battle.currentTurn == undefined) {
            battle.currentTurn = 1;
        }
        console.log('Tao turn');
        let currentTurn = battle.currentTurn;


        let newTurn = {
            id: currentTurn
        }
        let attacker = {
            userId: userId,
            skillCode: skillCode,
            attackerId: attackerId
        }

        console.log('Lay thong tin itemCode')

        if (itemCode != undefined && vlr.listUsers[userId].myGoods != undefined && vlr.listUsers[userId].myGoods[itemCode] != undefined && vlr.listUsers[userId].myGoods[itemCode].use == 1) { // Neu item duoc dung
            attacker.itemCode = itemCode;
        }
        newTurn.humanTurn = attacker
        if (battle.turn == undefined) {
            battle.turn = {}
        }
        battle.turn[currentTurn] = newTurn;
        // Gui lai cau hoi cho nguoi choi
        let attackedTurn = {
            attackerId: enemyTeam.attackerId
        };

        // Lay danh sach skill
        let listSkillOld = enemyTeam.listMembers[attackedTurn.attackerId].listSkill;

        let listSkill = []
        for (i = 0; i < listSkillOld.length; i++) {
            if (listSkillOld[i].status == 1) {
                listSkill.push(listSkillOld[i]);
            }
        }

        console.log('So luong skill cua quai:', listSkill.length, ' Chi tiet nhu sau:', listSkill);

        let index = 0;
        if (listSkill.length > 1) {
            index = common.getRndInteger(0, listSkill.length);
            console.log('Gia tri Skill tim duoc:', index);


        }

        console.log('Lay skill cua Ememy')
        let enemySkill = listSkill[index]; // Lay ngau nhien skill cua enemy
        attackedTurn.skillCode = enemySkill.code;
        console.log('Skill cua enemy la:', enemySkill)
        newTurn.enemyTurn = attackedTurn;

        let user = vlr.listUsers[userId];
        let currentQuestion = user.currentQuestion;
        io.to(user.socketid).emit('u_question', { userId: userId, question: currentQuestion });

    } catch (e) {
        console.log('p_skill_code_enemy:', e);

    }
}

const p_result_enemy = function (poolWrite, poolRead, Aerospike, client, vlr, configuration, io, data, socket) {
    try {
        console.log("p_result_enemy:", data);
        let battleId = data.battleId;
        let result = data.result;
        let userId = data.userId;
        if (battleId == undefined) {
            // Khong lam gi het du lieu sai
            return;
        }
        let battle = vlr.listEnemyBattles[battleId];
        if (battle == undefined) {
            // Khong lam gi het
            console.log('Battle null');
            return;
        }

        if (result == undefined) {
            console.log('result null');
            return;
        }
        // Refresh battle
        battle.refreshTime = Date.now();
        let user = vlr.listUsers[userId];
        // Lay trang thai cua turn
        let turn = battle.turn[battle.currentTurn];// Lay doi tuong turn
        if (turn == undefined) {
            console.log('Turn null');
            return; // Loi khong co turn
        }
        // let attacker = turn[userId];
        // attacker.result = result;
        // Lay team
        turn.result = result;
        let humanTeam = battle.humanTeam;

        if (result.result == 0) {// tra loi sai nen bi mat 
            humanTeam.lostTurn = humanTeam.lostTurn + 1;
        }
        // Build thong tin danh nhau
        console.log('loadFullSide');
        let newEnemyTeam;
        let newHumanTeam;
        let enemyTeam = battle.enemyTeam;

        //Doi quai doi attackerId

        common.getNewEnemyTeam(battleId, vlr).then(dataEnemy => {
            newEnemyTeam = dataEnemy;
            if (newEnemyTeam.listMembers[newEnemyTeam.attackerId].currentHealth <= 0) {
                enemyTeam.lostTurn = enemyTeam.lostTurn + 1;
            }
        }).then(() => {
            common.getNewHumanTeam(battleId, vlr).then(dataHuman => {
                newHumanTeam = dataHuman;
                vlr.listUsers[userId].mana = newHumanTeam.mana; // Cap nhat mana

                //Doi quai
                if (newEnemyTeam.listMembers[newEnemyTeam.attackerId].currentHealth <= 0) {
                    let enemyChange;
                    for (enemyChange in newEnemyTeam.listMembers) {
                        if (newEnemyTeam.listMembers[enemyChange].currentHealth > 0) {
                            newEnemyTeam.attackerId = parseInt(enemyChange);
                            continue;
                        }
                    }
                }

                io.to(vlr.listUsers[userId].socketid).emit('u_turn_enemy', { userId: userId, myTeam: newHumanTeam, otherTeam: newEnemyTeam });
                // Xoa du lieu cu
                if (battle.humanTeam != undefined) {
                    delete battle.humanTeam;
                    battle.humanTeam = newHumanTeam;
                    vlr.listUsers[userId].mana = newHumanTeam.mana;
                }
                if (battle.enemyTeam != undefined) {
                    delete battle.enemyTeam;
                    battle.enemyTeam = newEnemyTeam;
                }
            }).catch(error => {
                console.log('Loi khi lay thong tin cua nguoi va quai:', error);
            })
        }).catch(error => {
            console.log('Loi khi lay thong tin cua nguoi va quai:', error);
        })
        //tra lai cho client
        common.submitQuestion(userId, configuration, result).then(data => {
            if (data != undefined) {
                delete user.currentQuestion;
                user.currentQuestion = data;
                console.log('New question:', data);
                io.to(vlr.listUsers[userId].socketid).emit('u_update_question', { userId: userId, currentQuestion: user.currentQuestion });
            }
        }).catch(error => {
            console.log('Loi khi submit cau tra loi:', error);
        })

    } catch (e) {

    }
}

const p_turn_done_enemy = function (poolWrite, poolRead, Aerospike, client, vlr, configuration, io, data, socket) {
    try {
        console.log("p_turn_done_enemy");
        let battleId = data.battleId;
        let userId = data.userId;
        if (battleId == undefined) {
            // Khong lam gi het du lieu sai
            console.log('BattleId null')
            return;
        }
        let battle = vlr.listEnemyBattles[battleId];
        if (battle == undefined) {
            // Khong lam gi het
            console.log('Battle null')
            return;
        }
        // Refresh battle
        battle.refreshTime = Date.now();
        let user = vlr.listUsers[userId];
        // Lay trang thai cua turn
        // Xem tran dau ket thuc hay chua.
        // Neu co thi ai thang ? ai thua.
        // Neu chua biet nguoi thang nguoi thua thi se xem doi nguoi choi de gui lai cho nguoi dung choi tiep
        let humanTeam = battle.humanTeam;
        let enemyTeam = battle.enemyTeam;

        if (enemyTeam.listMembers[enemyTeam.turn.attackerId].tame == 1 && enemyTeam.listMembers[enemyTeam.turn.attackerId].currentHealth > 0) {

            io.to(vlr.listUsers[userId].socketid).emit('u_turn_enemy_tame', {
                error: 0,
                guide: user.currentAction.inGameGuide != undefined ? user.currentAction.inGameGuide : {}
            })
        }


        if (enemyTeam.currentHealth <= 0) {
            console.log('Nguoi da thang');
            // Lay prize
            let enemyKilledCode = vlr.areaEnemies.full[battle.enemyId].enemyCode;
            if (user.currentAction.actionType == 28 || user.currentAction.actionType == 3) {
                console.log('win, lam nhiem vu 28 hoac 3')

                let targetEnemy = user.currentAction.relation[Object.keys(user.currentAction.relation)[0]].relationCode;
                let targetCount = user.currentAction.relation[Object.keys(user.currentAction.relation)[0]].relationCount;

                let currentKillCount = user.currentActionKillCount;

                console.log('khanh 3/12 target code', targetEnemy)
                if (enemyKilledCode == targetEnemy || (enemyKilledCode != targetEnemy && (targetEnemy == null || targetEnemy == undefined))) {
                    console.log('khanh 3/12 vao truong hop dung', targetEnemy)
                    if (currentKillCount + 1 < targetCount) {
                        user.currentActionKillCount = user.currentActionKillCount + 1;
                        let killSql = 'update student st set current_action_kill_count = st.current_action_kill_count + 1 where id = $1'
                        poolWrite.query(killSql, [userId]);
                        common.getPrizeEnemyWon(vlr, poolWrite, humanTeam, true).then(dataPrize => {
                            if (vlr.listEnemyDead == undefined) {
                                vlr.listEnemyDead = {};
                            }

                            let enemyDead = {
                                enemyDeadId: battle.userId + "_" + battle.enemyId,
                                userId: battle.userId,
                                enemyId: battle.enemyId,
                                time: Date.now(),
                                areaCode: user.areaCode
                            }


                            vlr.listEnemyDead[enemyDead.enemyDeadId] = enemyDead;

                            // Thuc hien xoa thong tin tran chien o VLR(Danh sach tran chien)
                            delete vlr.listEnemyBattles[user.enemyBattleId]
                            // Thuc hien xoa thong tin tran chien o nguoi dung(Gan theo nguoi dung ở VLR)
                            delete vlr.listUsers[userId].enemyBattleId
                            // Viet them 1 ham 2 phut check mot lan de release con quai cho nhan vat.
                            console.log('u_turn_enemy_won');
                            // Gui tin hieu chien thang ve cho nguoi dùng.
                            io.to(vlr.listUsers[userId].socketid).emit('u_turn_enemy_won', { userId: userId, battleId: battleId, prize: dataPrize.prize, expEachMember: dataPrize.expEachMember, enemyLevelUp: dataPrize.enemyLevelUp });
                        }).catch(error => console.log('prize error', error));
                    } else if ((currentKillCount + 1 >= targetCount) || targetCount == 1) {
                        user.currentActionKillCount = 0;
                        let killSql = 'update student set current_action_kill_count = 0 where id = $1'
                        poolWrite.query(killSql, [userId]);
                        common.updateActionStatus(vlr, userId, poolWrite).then(data => {
                            // Cap nhat lai du lieu cho user
                            user.currentActionCode = data.nextActionCode;
                            user.currentTaskCode = data.nextTaskCode;
                            delete user.currentAction;
                            user.currentAction = vlr.actions.full[data.nextActionCode];
                            delete user.currentTask;
                            user.currentTask = vlr.tasks[data.nextTaskCode];
                            // Cap nhat db
                            let sql = 'update student set current_task_code = $1, current_action_code = $2 where id = $3';
                            poolWrite.query(sql, [user.currentTaskCode, user.currentActionCode, userId]);
                            // Send to client
                            if (user.currentAction.actionType == 18) {
                                common.checkActionLevelUp(vlr, userId, poolWrite).then(dataLevel => {
                                }).catch(errorLevel => {
                                    console.log("Loi trong qua trinh update:", errorLevel);
                                    res.status(502).json({
                                        error: 1,
                                        msg: 'Service Error'
                                    })
                                })
                            }
                            common.getPrizeEnemyWon(vlr, poolWrite, humanTeam, true).then(dataPrize => {
                                if (vlr.listEnemyDead == undefined) {
                                    vlr.listEnemyDead = {};
                                }

                                let enemyDead = {
                                    enemyDeadId: battle.userId + "_" + battle.enemyId,
                                    userId: battle.userId,
                                    enemyId: battle.enemyId,
                                    time: Date.now(),
                                    areaCode: user.areaCode
                                }


                                vlr.listEnemyDead[enemyDead.enemyDeadId] = enemyDead;

                                // Thuc hien xoa thong tin tran chien o VLR(Danh sach tran chien)
                                delete vlr.listEnemyBattles[user.enemyBattleId]
                                // Thuc hien xoa thong tin tran chien o nguoi dung(Gan theo nguoi dung ở VLR)
                                delete vlr.listUsers[userId].enemyBattleId
                                // Viet them 1 ham 2 phut check mot lan de release con quai cho nhan vat.
                                console.log('u_turn_enemy_won');
                                // Gui tin hieu chien thang ve cho nguoi dùng.
                                io.to(vlr.listUsers[userId].socketid).emit('u_turn_enemy_won', { userId: userId, battleId: battleId, prize: dataPrize.prize, expEachMember: dataPrize.expEachMember, enemyLevelUp: dataPrize.enemyLevelUp });
                            }).catch(error => console.log('prize error', error));
                        }).catch(error => {
                            console.log("Loi trong qua trinh update:", error);
                        })
                    }
                } else {
                    common.getPrizeEnemyWon(vlr, poolWrite, humanTeam).then(dataPrize => {
                        if (vlr.listEnemyDead == undefined) {
                            vlr.listEnemyDead = {};
                        }

                        let enemyDead = {
                            enemyDeadId: battle.userId + "_" + battle.enemyId,
                            userId: battle.userId,
                            enemyId: battle.enemyId,
                            time: Date.now(),
                            areaCode: user.areaCode
                        }


                        vlr.listEnemyDead[enemyDead.enemyDeadId] = enemyDead;

                        // Thuc hien xoa thong tin tran chien o VLR(Danh sach tran chien)
                        delete vlr.listEnemyBattles[user.enemyBattleId]
                        // Thuc hien xoa thong tin tran chien o nguoi dung(Gan theo nguoi dung ở VLR)
                        delete vlr.listUsers[userId].enemyBattleId
                        // Viet them 1 ham 2 phut check mot lan de release con quai cho nhan vat.
                        console.log('u_turn_enemy_won');
                        // Gui tin hieu chien thang ve cho nguoi dùng.
                        io.to(vlr.listUsers[userId].socketid).emit('u_turn_enemy_won', { userId: userId, battleId: battleId, prize: dataPrize.prize, expEachMember: dataPrize.expEachMember, enemyLevelUp: dataPrize.enemyLevelUp });
                    }).catch(error => console.log('prize error', error));

                }

            } else {
                common.getPrizeEnemyWon(vlr, poolWrite, humanTeam).then(dataPrize => {
                    if (vlr.listEnemyDead == undefined) {
                        vlr.listEnemyDead = {};
                    }

                    let enemyDead = {
                        enemyDeadId: battle.userId + "_" + battle.enemyId,
                        userId: battle.userId,
                        enemyId: battle.enemyId,
                        time: Date.now(),
                        areaCode: user.areaCode
                    }


                    vlr.listEnemyDead[enemyDead.enemyDeadId] = enemyDead;

                    // Thuc hien xoa thong tin tran chien o VLR(Danh sach tran chien)
                    delete vlr.listEnemyBattles[user.enemyBattleId]
                    // Thuc hien xoa thong tin tran chien o nguoi dung(Gan theo nguoi dung ở VLR)
                    delete vlr.listUsers[userId].enemyBattleId
                    // Viet them 1 ham 2 phut check mot lan de release con quai cho nhan vat.
                    console.log('u_turn_enemy_won');
                    // Gui tin hieu chien thang ve cho nguoi dùng.
                    io.to(vlr.listUsers[userId].socketid).emit('u_turn_enemy_won', { userId: userId, battleId: battleId, prize: dataPrize.prize, expEachMember: dataPrize.expEachMember, enemyLevelUp: dataPrize.enemyLevelUp });
                }).catch(error => console.log('prize error', error));

            }



        } else {// Quai chua thua

            if (humanTeam.currentHealth <= 0) {
                // Nguoi thua
                console.log('Nguoi thua')
                // Tra nguoi ve vi tri ban dau (Check point)
                if (vlr.listUsers[userId].checkPoint != undefined) {
                    vlr.listUsers[userId].px = vlr.listUsers[userId].checkPoint.px;
                    vlr.listUsers[userId].py = vlr.listUsers[userId].checkPoint.py;
                }
                // Xoa du lieu cho tran chien (Xoa thong tin nguoi dung, xoa thong tin cua tran chien)
                if (vlr.listUsers[userId].enemyBattleId) delete vlr.listUsers[userId].enemyBattleId;

                if (vlr.listEnemyBattles[battleId] != undefined) {
                    delete vlr.listEnemyBattles[battleId];
                }
                // Gui thong bao ket thuc tran chien
                io.to(vlr.listUsers[userId].socketid).emit('u_turn_enemy_lost', { userId: userId, battleId: battleId });
                // Duong cuoc choi nguoi thua
            } else {
                // Nguoi chua thua
                // Danh tiep
                console.log('Danh tiep')
                battle.currentTurn = battle.currentTurn + 1;
                io.to(vlr.listUsers[userId].socketid).emit('u_turn_enemy_next', { userId: userId, battleId: battleId, enemyAttacker: enemyTeam.attackerId });
            }
        }
    } catch (e) {
        console.log('p_turn_done_enemy exception:', e)

    }
}



module.exports = {
    p_join_area,
    p_change_area,
    p_position,
    p_chat,
    p_listenned,
    p_talked,
    p_returned_enemy,
    p_picked_goods,
    p_returned_goods,
    p_got_enemy,
    p_put_out_fire,
    p_returned_forest,
    p_flute,
    p_returned_stone,
    p_followed,
    p_npc_talked,
    p_area_auto_changed,
    p_skill_code_human,
    p_result_human,
    p_turn_done_human,
    p_skill_code_enemy,
    p_result_enemy,
    p_turn_done_enemy
}