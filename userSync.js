const common = require('./common.js');
const request = require('request');
const joinWorlds = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:joinWorlds:');
        // Todo code in here
        // Thực hiện load chi tiết dữ liệu người chơi đẩy lên caching
        let userId = parseInt(req.headers['userid']);
        let token = req.headers['token'];
        // Thuc hien song song de lay du lieu
        let getFullData = Promise.all([common.getStudent(userId, poolRead), common.getStudentHouse(userId, poolRead), common.getEnemy(userId, poolRead), common.getTeam(userId, poolRead), common.getGood(userId, poolRead), common.getMoney(userId, poolRead), common.getHouseFurniture(userId, poolRead), common.getCurrentQuestion(userId, configuration), common.getMap(userId, poolRead)]);
        getFullData.then(data => {
            console.log('data', data);
            if (data[0] == undefined) {
                res.status(502).json({
                    error: 1,
                    msg: 'Service Error'
                })
            } else {
                if (vlr.listUsers == undefined) {
                    vlr.listUsers = {}
                }
                let user = data[0];
                user.px = parseFloat(user.px); // CongVT add command
                user.py = parseFloat(user.py);
                let checkPoint = {
                    px: parseFloat(user.checkpointX),
                    py: parseFloat(user.checkpointY)
                }
                user.checkPoint = checkPoint;
                delete user.checkpointX;
                delete user.checkpointY;

                user.token = token;

                if (data[1] != undefined) {
                    user.houses = data[1];
                }
                if (data[2] != undefined) {
                    user.myPets = data[2];
                }
                if (data[3] != undefined) {
                    user.myTeam = data[3];
                }
                if (data[4] != undefined) {
                    user.myGoods = {};
                    user.mySpecialGoods = {};
                    user.mySpecialEnemies = {};

                    let goodsCode;
                    for (goodsCode in data[4]) {
                        if (vlr.goods[goodsCode].use == 0) {
                            if (vlr.goods[goodsCode].type == "specialenemy") {
                                user.mySpecialEnemies[goodsCode] = data[4][goodsCode];
                                continue;
                            }
                            user.mySpecialGoods[goodsCode] = data[4][goodsCode];
                            continue;
                        }
                        user.myGoods[goodsCode] = data[4][goodsCode];
                    }
                }
                if (data[5] != undefined) {
                    user.money = data[5];
                }
                if (data[6] != undefined) {
                    user.houseFurniture = data[6];
                }
                if (data[7] != undefined) {
                    user.currentQuestion = data[7];
                }

                if (data[8] != undefined) {
                    user.myMaps = data[8];
                    let missMap = false;
                    if (user.myMaps["lamplight"] == undefined) {
                        user.myMaps["lamplight"] = {
                            mapCode: 'lamplight',
                            status: 1
                        }
                        missMap = true;
                    }
                    if (user.myMaps["castle"] == undefined) {
                        user.myMaps["castle"] = {
                            mapCode: 'castle',
                            status: 1
                        }
                        missMap = true;
                    }
                    if (user.myMaps["plant"] == undefined) {
                        user.myMaps["plant"] = {
                            mapCode: 'plant',
                            status: 1
                        }
                        missMap = true;
                    }
                    if (missMap == true) {
                        let sqlMap = "insert into student_maps (map_code, status, student_id) values ('lamplight', 1, $1), ('castle', 1, $1), ('plant',1, $1) on conflict (map_code, student_id) do nothing;"
                        poolWrite.query(sqlMap, [userId]);
                    }
                }

                if (user.currentTaskCode != undefined) {
                    user.currentTask = vlr.tasks[user.currentTaskCode];
                }

                if (user.currentActionCode != undefined) {
                    user.currentAction = vlr.actions.full[user.currentActionCode];
                }

                //Set quai di theo


                user.refreshTime = Date.now()
                // Kiem tra thong tin da co hay chua
                if (vlr.listUsers[userId] != undefined) {
                    delete vlr.listUsers[userId];
                }
                vlr.listUsers[userId] = user // Add thong tin vao Game server
                // Cai dat timer cho viec release sau thoi gian dang nhap
                // releaseUser = function (vlr, userId, io)
                common.checkPetFollowing(vlr, userId);

                res.status(200).json({
                    error: 0,
                    msg: 'Đăng ký thành công',
                    user: user
                })
            }
        }).catch(function (error) {
            console.log(error); // "Boom!"
            res.status(502).json({
                error: 1,
                msg: 'Service Error'
            })
        });
    } catch (e) {
        console.log('[Error]:joinWorlds:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }

}
const userLogout = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:userLogout:');
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId];
        // Todo code in here
        let currentArea = user.areaCode;
        //release khoi area
        if (vlr.areas[currentArea] != undefined && vlr.areas[currentArea].listUsers != undefined && vlr.areas[currentArea].listUsers[userId] != undefined) {
            delete vlr.areas[currentArea].listUsers[userId];
            let i;
            for (i in vlr.areas[currentArea].listUsers) {
                io.to(vlr.listUsers[i].socketid).emit('u_user_remove', { userId: userId });
            }
        }
        //Xoa khoi listUser vlr
        delete vlr.listUsers[userId];
        res.status(200).json({
            error: 0,
            msg: 'Logout thanh cong'
        })
    } catch (e) {
        console.log('[Error]:userLogout:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}
const userInfo = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:userClasses:');
        let userId = parseInt(req.headers['userid']);
        let grade = req.body.grade;
        let name = req.body.name;

        if (grade == undefined || name == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'Bad request'
            })
            return;
        }
        let sql = 'update student set grade = $1, name = $2, status = case when status = 0 then 2 else  status  end where id = $3 RETURNING status';
        poolWrite.query(sql, [grade, name, userId], (error, results) => {
            if (error || results.rows == undefined) {
                // Loi update khong thanh cong
                res.status(502).json({
                    error: 1,
                    msg: 'Service Error'
                })
                return;
            }
            console.log('Ket qua tra ve:', results.rows[0])

            let createUserCore = {
                url: configuration.ECoreEngineLink + '/students',
                method: 'POST',
                json: {
                    studentId: userId,
                    grade: grade,
                    key: configuration.ECoreEngineKey
                }
            };
            console.log('Goi ham tao account:' + JSON.stringify(createUserCore))
            /*
            request(createUserCore, (error, response1, body) => {
                if (error) {
                    console.log('Create user fail:' + userId);
                } else {
                    console.log('Create user Thanh cong:' + userId, 'Body:', body);
                }
            })

            */
            res.status(200).json({
                error: 0,
                msg: 'Update OK',
                userId: userId,
                status: results.rows[0].status
            })
            //Todo can tra ve thong tin o day
        })
    } catch (e) {
        console.log('[Error]:userInfo:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}
const userClasses = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:userClasses:');
        let grade = req.body.grade;
        let userId = parseInt(req.headers['userid']);

        if (grade == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'Bad request'
            })
            return;
        }
        let sql = 'update student set grade = $1, status = case when status =0 then 1 else  status  end where id = $2 RETURNING status';
        poolWrite.query(sql, [grade, userId], (error, results) => {
            if (error || results.rows == undefined) {
                // Loi update khong thanh cong
                res.status(502).json({
                    error: 1,
                    msg: 'Service Error'
                })
                return;
            }
            console.log('Ket qua tra ve:', results.rows[0])
            res.status(200).json({
                error: 0,
                msg: 'Update OK',
                userId: userId,
                status: results.rows[0].status
            })
            //Todo can tra ve thong tin o day
        })
    } catch (e) {
        console.log('[Error]:userClasses:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }

}
const userNames = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:userNames:');
        // Todo code in here
        let name = req.body.name;
        let userId = parseInt(req.headers['userid']);

        if (name == undefined) {
            res.status(400).json({
                error: '1',
                msg: 'Bad request'
            })
            return;
        }
        let sql = 'update student set name = $1, status = case when status =1 then 2 else  status  end where id = $2 RETURNING status';
        poolWrite.query(sql, [name, userId], (error, results) => {
            if (error || results.rows == undefined) {
                // Loi update khong thanh cong
                res.status(502).json({
                    error: 1,
                    msg: 'Service Error'
                })
                return;
            }
            console.log('Ket qua tra ve:', results.rows[0])
            res.status(200).json({
                error: 0,
                msg: 'Update OK',
                userId: userId,
                status: results.rows[0].status
            })
            //Todo can tra ve thong tin o day
        })

    } catch (e) {
        console.log('[Error]:userNames:', e);
        res.status(502).json({
            error: '1',
            msg: 'Service Error'
        })
    }

}
const userCharacters = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:userCharacters:');
        // Todo code in here
        let userId = parseInt(req.headers['userid']);
        let gender = req.body.gender;
        let hairStyle = req.body.hairStyle;
        let hairColor = req.body.hairColor;
        let skinColor = req.body.skinColor;
        let sql;
        let sqlStudentGoods;
        switch (gender) {
            case "M":
                sql = 'update student set gender = COALESCE ($1, gender , $1), hair_style = COALESCE ($2, hair_style , $2), hair_color = COALESCE ($3, hair_color , $3),skin_color = COALESCE ($4, skin_color , $4), wand_code = \'wand0\', outfits_code = \'outfit0_nam\', status = case when status =2 then 3 else  status  end where id = $5 RETURNING status';
                sqlStudentGoods = 'insert into student_goods(goods_code, count, student_id) values (\'wand0\', 1, $1), (\'outfit0_nam\', 1, $1) ON CONFLICT (goods_code, student_id) DO UPDATE SET count = student_goods.count + 1 returning goods_code, count, id';
                break;
            case "F":
                sql = 'update student set gender = COALESCE ($1, gender , $1), hair_style = COALESCE ($2, hair_style , $2), hair_color = COALESCE ($3, hair_color , $3),skin_color = COALESCE ($4, skin_color , $4), wand_code = \'wand0\', outfits_code = \'outfit0_nu\', status = case when status =2 then 3 else  status  end where id = $5 RETURNING status';
                sqlStudentGoods = 'insert into student_goods(goods_code, count, student_id) values (\'wand0\', 1, $1), (\'outfit0_nu\', 1, $1) ON CONFLICT (goods_code, student_id) DO UPDATE SET count = student_goods.count + 1 returning goods_code, count, id';
                break;
            default:
                sql = 'update student set gender = COALESCE ($1, gender , $1), hair_style = COALESCE ($2, hair_style , $2), hair_color = COALESCE ($3, hair_color , $3),skin_color = COALESCE ($4, skin_color , $4), wand_code = \'wand0\', status = case when status =2 then 3 else  status  end where id = $5 RETURNING status';
                sqlStudentGoods = 'insert into student_goods(goods_code, count, student_id) values (\'wand0\', 1, $1) ON CONFLICT (goods_code, student_id) DO UPDATE SET count = student_goods.count + 1 returning goods_code, count, id';
                break;
        }
        // Cho wand mac dinh wand0
        // Cho quan ao mac dinh
        /**
         outfit0_nam
         outfit0_nu;
          
         */
        poolWrite.query(sql, [gender, hairStyle, hairColor, skinColor, userId], (error, resultsStudent) => {
            if (error || resultsStudent.rows == undefined) {
                // Loi update khong thanh cong
                res.status(502).json({
                    error: 1,
                    msg: 'Service Error'
                })
                return;
            }
            if (vlr.listUsers[userId] != undefined) {
                vlr.listUsers[userId].wandCode = 'wand0';
                if (gender == "M") {
                    vlr.listUsers[userId].outfitsCode = 'outfit0_nam';
                } else if (gender == "F") {
                    vlr.listUsers[userId].outfitsCode = 'outfit0_nu';
                }
            }

            poolWrite.query(sqlStudentGoods, [userId], (error, resultsGoods) => {
                if (error || resultsGoods.rows == undefined) {
                    // Loi update khong thanh cong
                    res.status(502).json({
                        error: 1,
                        msg: 'Service Error'
                    })
                    return;
                }
                if (vlr.listUsers[userId] != undefined) {
                    if (vlr.listUsers[userId].myGoods == undefined) {
                        vlr.listUsers[userId].myGoods = {};
                    }
                    vlr.listUsers[userId].myGoods[resultsGoods.rows[0].goods_code] = {
                        goodsId: resultsGoods.rows[0].id,
                        goodsCode: resultsGoods.rows[0].goods_code,
                        count: resultsGoods.rows[0].count
                    };
                    vlr.listUsers[userId].myGoods[resultsGoods.rows[1].goods_code] = {
                        goodsId: resultsGoods.rows[1].id,
                        goodsCode: resultsGoods.rows[1].goods_code,
                        count: resultsGoods.rows[1].count
                    };
                }

                console.log('Ket qua tra ve:', resultsStudent.rows[0])
                res.status(200).json({
                    error: 0,
                    msg: 'Update OK',
                    userId: userId,
                    status: resultsStudent.rows[0].status
                })
            })

            //Todo can tra ve thong tin o day
        })
    } catch (e) {
        console.log('[Error]:userCharacters:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }

}
const postUsersFriends = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:postUsersFriends:');
        // Todo code in here


    } catch (e) {
        console.log('[Error]:postUsersFriends:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }

}
const putUsersFriends = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:putUsersFriends:');
        // Todo code in here


    } catch (e) {
        console.log('[Error]:putUsersFriends:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }

}
const getUsersFriends = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:getUsersFriends:');
        // Todo code in here


    } catch (e) {
        console.log('[Error]:getUsersFriends:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}
const getUsersHouse = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:getUsersHouse:');
        // Todo code in here
        let userId = req.params.id;
        let user = vlr.listUsers[userId];


        res.status(200).json({
            error: 0,
            msg: 'OK',
            userId: userId,
            currentHouse: user.currentHouse,
            houseFurniture: user.houseFurniture
        })
    } catch (e) {
        console.log('[Error]:getUsersHouse:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }

}
const getUsersTeams = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:getUsersTeams:');
        // Todo code in here
        // Build danh sach team va tra lai client
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId]
        let array = Object.keys(user.myTeam)
            .map(function (key) {
                return user.myTeam[key];
            });
        res.status(200).json({
            error: 0,
            msg: 'ok',
            userId: userId,
            team: array
        })

    } catch (e) {
        console.log('[Error]:getUsersTeams:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }

}
const putUserTeams = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:putUserTeams:');
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId];
        let enemyId = req.body.enemyId;
        let enemyIndex = req.body.enemyIndex;

        //check ok
        if (enemyId == undefined || enemyIndex == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'enemyId hoac enemyIndex undefined'
            })
            return
        }
        //kiem tra index
        if (enemyIndex < 1 || enemyIndex > 3) {
            res.status(400).json({
                error: 1,
                msg: 'index phai tu 1 - 3'
            })
            return
        }

        let userTeam = {};
        let i;
        for (i in user.myTeam) {
            userTeam[user.myTeam[i].index] = user.myTeam[i].enemyId;
        }

        //truong hop xoa khoi team
        if (enemyId == -1) {
            //Kiem tra co nhieu hon 1 con thu khong
            if (Object.keys(userTeam).length <= 1) {
                res.status(400).json({
                    error: 1,
                    msg: 'Phai co 1 con thu trong team'
                })
                return
            }
            if (userTeam[enemyIndex] == undefined) {
                res.status(200).json({
                    error: 1,
                    msg: 'vi tri nay da khong co quai roi'
                })
                return
            }
            //Ok xoa
            //Xoa tren vlr
            delete user.myTeam[userTeam[enemyIndex]]
            //Xoa o DB
            let sqlStudentTeamEmpty = 'delete from student_team where student_id = $1 and enemy_id = $2'
            poolWrite.query(sqlStudentTeamEmpty, [userId, userTeam[enemyIndex]]);

            //Sap xep lai quai
            common.checkPetFollowing(vlr, userId);
            res.status(200).json({
                error: 0,
                myTeam: user.myTeam,
                myPets: user.myPets
            })
            return
        }

        //Khong co pet khong cho doi
        if (user.myPets[enemyId] == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'ban khong co pet nay'
            })
            return
        }
        if (user.myTeam[enemyId] != undefined) {
            if (user.myTeam[enemyId].index == enemyIndex) {
                res.status(200).json({
                    error: 1,
                    msg: 'von di vi tri no da o day roi',
                })
                return
            }
        }
        //Truong hop cho trong do con 
        if (userTeam[enemyIndex] == undefined) {
            //pet trong balo
            if (user.myTeam[enemyId] == undefined) {
                //cho vao vlr
                user.myTeam[enemyId] = {
                    enemyId: enemyId,
                    index: enemyIndex
                };
                //update DB
                let sqlInsertEnemy = 'insert into student_team (enemy_id, student_id, index) values ($1, $2, $3)';
                poolWrite.query(sqlInsertEnemy, [enemyId, userId, enemyIndex]);

                //Set quai di theo
                common.checkPetFollowing(vlr, userId);
                res.status(200).json({
                    error: 0,
                    myTeam: user.myTeam,
                    myPets: user.myPets
                })
                return
            } else {
                //pet trong team
                delete user.myTeam[userTeam[enemyIndex]];
                // update tren vlr
                user.myTeam[enemyId] = {
                    enemyId: enemyId,
                    index: enemyIndex
                }
                //sua o DB

                let sqlStudentTeamSlot = 'update student_team set index = $1 where student_id = $2 and enemy_id = $3'
                poolWrite.query(sqlStudentTeamSlot, [enemyIndex, userId, enemyId]);

                //Set quai di theo
                common.checkPetFollowing(vlr, userId);

                res.status(200).json({
                    error: 0,
                    myTeam: user.myTeam,
                    myPets: user.myPets
                })
                return
            }
        } else if (user.myTeam[enemyId] != undefined) {
            // truong hop doi cho
            let idOldPet = userTeam[enemyIndex];
            let indexNewPet = user.myTeam[enemyId].index;
            user.myTeam[idOldPet].index = indexNewPet;
            // update tren vlr
            user.myTeam[enemyId].index = enemyIndex;

            //update db
            let sqlStudentTeamSwap = 'update student_team set index = case enemy_id when $1 then $2 when $3 then $4 end where enemy_id in($1, $3) and student_id = $5'
            poolWrite.query(sqlStudentTeamSwap, [idOldPet, indexNewPet, enemyId, enemyIndex, userId]);

            //Set quai di theo
            common.checkPetFollowing(vlr, userId);

            res.status(200).json({
                error: 0,
                myTeam: user.myTeam,
                myPets: user.myPets
            })
            return
        } else if (user.myTeam[enemyId] == undefined) {
            // truong hop doi cho
            // xoa no trong team
            delete user.myTeam[userTeam[enemyIndex]];
            user.myTeam[enemyId] = {
                enemyId: enemyId,
                index: enemyIndex
            }
            //update db
            let sqlStudentTakeOver = 'update student_team set enemy_id = $1 where student_id = $2 and index = $3'
            poolWrite.query(sqlStudentTakeOver, [enemyId, userId, enemyIndex]);

            //Set quai di theo
            common.checkPetFollowing(vlr, userId);

            res.status(200).json({
                error: 0,
                myTeam: user.myTeam,
                myPets: user.myPets
            })
            return
        }
        res.status(502).json({
            error: 1,
            msg: "khong co truong hop nao putUserTeams"
        })
        return
    } catch (e) {
        console.log('[Error]:putUserTeams:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }

}
const getUsersInfo = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:getUsersInfo:');
        // Todo code in here
        let id = req.params.id;
        let userId = parseInt(req.headers['userid']);
        if (id == undefined || id == userId) {
            // Lay cua chinh user do
            let user = vlr.listUsers[userId]
            res.status(200).json({
                error: 0,
                msg: 'OK',
                user: user
            })
        } else {
            // Lay cua user khac
            common.getStudent(id, poolRead).then(data => {
                res.status(200).json({
                    error: 0,
                    msg: 'OK',
                    user: data
                })
            }).catch(error => {
                console.log('Loi khi getUsersInfo: userId=', id, ' exception:', error);
                res.status(502).json({
                    error: 1,
                    msg: 'Service Error'
                })
            })
        }
    } catch (e) {
        console.log('[Error]:getUsersInfo:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }

}
const getMyPets = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:getMyPets:');
        // Lay thong tin tu VLR
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId]
        let myTeams = [];
        let pets = [];
        let i;
        for (i in user.myPets) {
            let enemy = {
                id: user.myPets[i].enemyId,
                evolutionLevel: user.myPets[i].evolutionLevel,
                level: user.myPets[i].level,
                code: user.myPets[i].enemyCode,
                exp: user.myPets[i].exp,
                elementCode: vlr.enemies[user.myPets[i].enemyCode].elementCode,
                baseDame: vlr.enemies[user.myPets[i].enemyCode].baseDame,
                baseHealth: vlr.enemies[user.myPets[i].enemyCode].baseHealth,
                nameEn: vlr.enemies[user.myPets[i].enemyCode].nameEn,
                nameVn: vlr.enemies[user.myPets[i].enemyCode].nameVn,
                infoVn: vlr.enemies[user.myPets[i].enemyCode].infoVn,
                infoEn: vlr.enemies[user.myPets[i].enemyCode].infoEn,
                infoEnVoice: vlr.enemies[user.myPets[i].enemyCode].infoEnVoice,
                infoVnVoice: vlr.enemies[user.myPets[i].enemyCode].infoVnVoice,
            }
            pets.push(enemy);
            if (user.myTeam[enemy.id] != undefined) {
                enemy.index = user.myTeam[enemy.id].index
                myTeams.push(enemy)
            }
        }
        res.status(200).json({
            error: 0,
            msg: 'OK',
            pets: pets,
            myTeams: myTeams
        })

    } catch (e) {
        console.log('[Error]:getMyPets:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }

}

const getMaps = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:getMaps:');
        // Lay thong tin tu VLR
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId];
        let allMaps = vlr.maps;
        let userMaps = user.myMaps;

        let i;
        for (i in allMaps) {
            if (userMaps[i] == undefined) {
                userMaps[i] = {
                    mapCode: i,
                    status: 0
                }
            }
        }

        res.status(200).json({
            error: 0,
            maps: userMaps
        })

    } catch (e) {
        console.log('[Error]:getMaps:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }

}
const getUsersEnemiesDetail = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:getUsersEnemiesDetail:');
        let id = req.params.id;
        let user = vlr.listUsers[id]
        if (user == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'Khong co user nay'
            })
        }

        let enemies = user.myPets;

        for (i in enemies) {
            enemies[i].elementCode = vlr.enemies[enemies[i].enemyCode].elementCode;
            enemies[i].baseDame = vlr.enemies[enemies[i].enemyCode].baseDame;
            enemies[i].baseHealth = vlr.enemies[enemies[i].enemyCode].baseHealth;
            enemies[i].nameEn = vlr.enemies[enemies[i].enemyCode].nameEn;
            enemies[i].nameVn = vlr.enemies[enemies[i].enemyCode].nameVn;
            enemies[i].infoVn = vlr.enemies[enemies[i].enemyCode].infoVn;
            enemies[i].infoEn = vlr.enemies[enemies[i].enemyCode].infoEn;
            enemies[i].infoEnVoice = vlr.enemies[enemies[i].enemyCode].infoEnVoice;
            enemies[i].infoVnVoice = vlr.enemies[enemies[i].enemyCode].infoVnVoice;
        }
        res.status(200).json({
            error: 0,
            msg: 'OK',
            enemies: enemies
        })
    } catch (e) {
        console.log('[Error]:getUsersEnemiesDetail:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }

}
const getUsersGoods = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:getUsersGoods:');
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId]
        let goods = user.myGoods;
        for (i in goods) {
            goods[i].elementCode = vlr.goods[i].elementCode;
            goods[i].type = vlr.goods[i].type;
            goods[i].infoEn = vlr.goods[i].infoEn;
            goods[i].infoVn = vlr.goods[i].infoVn;
            goods[i].nameEn = vlr.goods[i].nameEn;
            goods[i].nameVn = vlr.goods[i].nameVn;
            goods[i].infoEnVoice = vlr.goods[i].infoEnVoice;
            goods[i].infoVnVoice = vlr.goods[i].infoVnVoice;
            goods[i].use = vlr.goods[i].use;
            if (user.hatCode == i || user.wandCode == i || user.outfitsCode == i || user.bootCode == i || user.ringCode == i) {
                goods[i].active = 1;
                goods[i].stock = goods[i].count - 1;
            } else {
                goods[i].active = 0;
                goods[i].stock = goods[i].count;
            }
        }
        res.status(200).json({
            error: 0,
            msg: 'OK',
            goods: goods
        })
    } catch (e) {
        console.log('[Error]:getUsersGoods:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }

}
const getUsersMoney = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:getUsersMoney:');
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId]
        let money = user.money;

        if (money == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'money undefined'
            })
            return
        }
        res.status(200).json({
            error: 0,
            msg: 'OK',
            userId: userId,
            money: money
        })

    } catch (e) {
        console.log('[Error]:getUsersMoney:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }

}
const getAreaNPCs = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:getAreaNPCs:');
        // Todo code in here
        // Can tra ve thong tin cua doi tuong trong ban area_npc kem theo danh sach cac mat hang duoc hien thi, cu the: area_npc_goods, kem theo chi tiet cua tung mat hang
        let id = req.params.id;
        console.log('id cua getAreaNPC:', id);
        let NPC = vlr.areaNPCs.full[id]
        //Todo fix here
        NPC.areaNPCGoods = vlr.areaNPCGoods[id];

        res.status(200).json({
            error: 0,
            msg: 'OK',
            NPC: NPC
        })

    } catch (e) {
        console.log('[Error]:getAreaNPCs:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }

}

const getNPCShop = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:getNPCShop:');
        // Todo code in here
        // Can tra ve thong tin cua doi tuong trong ban area_npc kem theo danh sach cac mat hang duoc hien thi, cu the: area_npc_goods, kem theo chi tiet cua tung mat hang
        let NPCCode = req.body.NPCCode;
        let NPCInfo = common.NPCCodeToId(NPCCode);
        let goods = vlr.areaNPCGoods[parseInt(NPCInfo.id)];

        let i;
        for (i in goods) {
            goods[i].elementCode = vlr.goods[i].elementCode;
            goods[i].price = parseInt(vlr.goods[i].price);
            goods[i].type = vlr.goods[i].type;
            goods[i].infoEn = vlr.goods[i].infoEn;
            goods[i].infoVn = vlr.goods[i].infoVn;
            goods[i].nameEn = vlr.goods[i].nameEn;
            goods[i].nameVn = vlr.goods[i].nameVn;
            goods[i].infoEnVoice = vlr.goods[i].infoEnVoice;
            goods[i].infoVnVoice = vlr.goods[i].infoVnVoice;
            goods[i].gender = vlr.goods[i].gender;
        }

        if (goods != undefined) {
            res.status(200).json({
                error: 0,
                msg: 'OK',
                type: parseInt(NPCInfo.type),
                goods: goods,
                myGoods: vlr.listUsers[parseInt(req.headers['userid'])].myGoods
            })
        } else {
            res.status(400).json({
                error: 1,
                msg: 'Error',
            })
        }



    } catch (e) {
        console.log('[Error]:NPCCode:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }

}

const postUsersTrans = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:postUsersTrans:');
        // Todo code in here


    } catch (e) {
        console.log('[Error]:postUsersTrans:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }

}

const putUsersPets = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        let enemyId = req.body.enemyId;
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId]

        if (enemyId == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'enemyId invalid'
            })
            return
        }

        //Kiem tra enemyId trong DB
        if (enemyId == user.petId) {
            //Trung 
            res.status(200).json({
                error: 0,
                msg: 'Ban dang dung pet nay roi'
            })
        } else {
            //Kiem tra xem enemyId co trong student enemy khong
            if (user.myPets[enemyId] == undefined) {
                //Khong nam trong ds my pet
                res.status(400).json({
                    error: 1,
                    msg: 'Ban khong so huu con enemy nay'
                })
            } else {
                //Set con pet len petId
                user.petId = enemyId;

                let sql = 'update student set pet_id = $1 where id = $2'

                poolWrite.query(sql, [enemyId, userId]);
                res.status(200).json({
                    error: 0,
                    msg: 'Set pet thanh cong'
                })
            }
        }

    } catch (e) {
        console.log('[Error]:putUsersPets:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}

const putUsersWands = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        let goodsId = req.body.goodsId;
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId]


        if (goodsId == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'goodsId invalid'
            })
            return
        }

        //Kiem tra goodsId trong DB
        if (user.myGoods[goodsId] == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'Khong su huu goods nay'
            })
            return
        }


        //Kiem tra phai wand hay khong
        let goodsCode = user.myGoods[goodsId].goodsCode
        let goods = vlr.goods[goodsCode]
        if (goods == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'Wand nay khong ton tai'
            })
            return
        }

        if (goods.type != "wand") {
            res.status(400).json({
                error: 1,
                msg: 'Day khong phai la wand'
            })
            return
        }

        user.wandCode = goodsCode;

        let sql = 'update student set wand_code = $1 where id = $2'

        poolWrite.query(sql, [goodsCode, userId]);
        res.status(200).json({
            error: 0,
            msg: 'Set wand thanh cong'
        })


    } catch (e) {
        console.log('[Error]:putUsersWands:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}

const putUsersHats = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        let goodsId = req.body.goodsId;
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId]


        if (goodsId == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'goodsId invalid'
            })
            return
        }

        //Kiem tra goodsId trong DB
        if (user.myGoods[goodsId] == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'Khong su huu goods nay'
            })
            return
        }


        //Kiem tra phai hat hay khong
        let goodsCode = user.myGoods[goodsId].goodsCode
        let goods = vlr.goods[goodsCode]

        if (goods == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'goods nay khong ton tai'
            })
            return
        }

        if (goods.type != "hat") {
            res.status(400).json({
                error: 1,
                msg: 'Day khong phai la Hat'
            })
            return
        }

        user.hatCode = goodsCode;

        let sql = 'update student set hat_code = $1 where id = $2'

        poolWrite.query(sql, [goodsCode, userId]);
        res.status(200).json({
            error: 0,
            msg: 'Set hat thanh cong'
        })


    } catch (e) {
        console.log('[Error]:putUsersHats:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}

const putUsersOutfits = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        let goodsCode = req.body.goodsCode;
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId]
        let myOutfitCode = user.outfitsCode;
        if (goodsCode == "" && user.myGoods[myOutfitCode] != undefined && user.myGoods[myOutfitCode].active == 1) {
            // Cap nhat lai myGood
            // Cap nhat lai trang thai
            user.myGoods[myOutfitCode].active = 0;

            if (user.myGoods[myOutfitCode].stock != undefined) {
                user.myGoods[myOutfitCode].stock = user.myGoods[myOutfitCode].stock + 1;
            }

            // Set mang ao mac dinh
            let sql = 'update student set outfits_code = $2 where id = $1';
            if (user.gender == 'M') {
                user.outfitsCode = 'outfit0_nam';

                delete user.myGoods['outfit0_nam'].active;
                user.myGoods['outfit0_nam'].active = 1;
                if (user.myGoods['outfit0_nam'].stock != undefined) {
                    user.myGoods['outfit0_nam'].stock = user.myGoods['outfit0_nam'].stock - 1;
                }

                poolWrite.query(sql, [userId, 'outfit0_nam']);
            } else {
                user.outfitsCode = 'outfit0_nu';

                delete user.myGoods['outfit0_nu'].active;
                user.myGoods['outfit0_nu'].active = 1;
                if (user.myGoods['outfit0_nu'].stock != undefined) {
                    user.myGoods['outfit0_nu'].stock = user.myGoods['outfit0_nu'].stock - 1;
                }

                poolWrite.query(sql, [userId, 'outfit0_nu']);
            }
            res.status(200).json({
                error: 0,
                msg: 'outfit OFF',
                goods: user.myGoods
            })
            return
        }
        //Kiem tra goodsId trong DB
        if (user.myGoods[goodsCode] == undefined) {
            console.log('putUsersOutfits: Khong su huu goods nay:', goodsCode);
            res.status(400).json({
                error: 1,
                msg: 'Khong su huu goods nay'
            })
            return
        }


        //Kiem tra phai outfit hay khong
        // let goodsCode = user.myGoods[goodCode].goodsCode
        let goods = vlr.goods[goodsCode]

        if (goods == undefined) {
            console.log('putUsersOutfits: goods nay khong ton tai');
            res.status(400).json({
                error: 1,
                msg: 'goods nay khong ton tai'
            })
            return
        }
        if (goods.type != "outfit") {
            console.log('putUsersOutfits: Day khong phai la Outfit');
            res.status(400).json({
                error: 1,
                msg: 'Day khong phai la Outfit'
            })
            return
        }
        user.outfitsCode = goodsCode;
        if (user.myGoods[myOutfitCode] != undefined) user.myGoods[myOutfitCode].active = 0;
        user.myGoods[goodsCode].active = 1;

        if (user.myGoods[myOutfitCode].stock != undefined) {
            user.myGoods[myOutfitCode].stock = user.myGoods[myOutfitCode].stock + 1;
        }

        if (user.myGoods[goodsCode].stock != undefined) {
            user.myGoods[goodsCode].stock = user.myGoods[goodsCode].stock - 1;
        }

        let sql = 'update student set outfits_code = $1 where id = $2'
        poolWrite.query(sql, [goodsCode, userId]);
        res.status(200).json({
            error: 0,
            msg: 'outfit ON',
            goods: user.myGoods
        })


    } catch (e) {
        console.log('[Error]:putUsersOutfits:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}

const putUsersBoots = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        let goodsId = req.body.goodsId;
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId]


        if (goodsId == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'goodsId invalid'
            })
            return
        }

        //Kiem tra goodsId trong DB
        if (user.myGoods[goodsId] == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'Khong su huu goods nay'
            })
            return
        }


        //Kiem tra phai boot hay khong
        let goodsCode = user.myGoods[goodsId].goodsCode
        let goods = vlr.goods[goodsCode]

        if (goods == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'goods nay khong ton tai'
            })
            return
        }


        if (goods.type != "boot") {
            res.status(400).json({
                error: 1,
                msg: 'Day khong phai la Boot'
            })
            return
        }

        user.bootCode = goodsCode;

        let sql = 'update student set boot_code = $1 where id = $2'

        poolWrite.query(sql, [goodsCode, userId]);
        res.status(200).json({
            error: 0,
            msg: 'Set boot thanh cong'
        })


    } catch (e) {
        console.log('[Error]:putUsersBoots:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}

const putUsersRings = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        let goodsId = req.body.goodsId;
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId]


        if (goodsId == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'goodsId invalid'
            })
            return
        }

        //Kiem tra goodsId trong DB
        if (user.myGoods[goodsId] == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'Khong su huu goods nay'
            })
            return
        }


        //Kiem tra phai ring hay khong
        let goodsCode = user.myGoods[goodsId].goodsCode
        let goods = vlr.goods[goodsCode]

        if (goods == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'goods nay khong ton tai'
            })
            return
        }


        if (goods.type != "ring") {
            res.status(400).json({
                error: 1,
                msg: 'Day khong phai la Ring'
            })
            return
        }

        user.bootCode = goodsCode;

        let sql = 'update student set ring_code = $1 where id = $2'

        poolWrite.query(sql, [goodsCode, userId]);
        res.status(200).json({
            error: 0,
            msg: 'Set ring thanh cong'
        })


    } catch (e) {
        console.log('[Error]:putUsersRings:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}

const putUsersHairStyles = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        let hairStylesCode = req.body.hairStylesCode;
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId]


        if (hairStylesCode == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'hairStylesCode invalid'
            })
            return
        }

        user.hairStyle = hairStylesCode;

        let sql = 'update student set hair_style = $1 where id = $2'

        poolWrite.query(sql, [hairStylesCode, userId]);
        res.status(200).json({
            error: 0,
            msg: 'Set hairStyle thanh cong'
        })


    } catch (e) {
        console.log('[Error]:putUsersHairStyles:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}

const putUsersHairColors = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        let hairColorsCode = req.body.hairColorsCode;
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId]


        if (hairColorsCode == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'hairColorsCode invalid'
            })
            return
        }

        user.hairColor = hairColorsCode;

        let sql = 'update student set hair_color = $1 where id = $2'

        poolWrite.query(sql, [hairColorsCode, userId]);
        res.status(200).json({
            error: 0,
            msg: 'Set hairColors thanh cong'
        })


    } catch (e) {
        console.log('[Error]:putUsersHairColors:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}

const putUsersSkinColors = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        let skinColorsCode = req.body.skinColorsCode;
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId]


        if (skinColorsCode == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'skinColorsCode invalid'
            })
            return
        }

        user.skinColor = skinColorsCode;

        let sql = 'update student set skin_color = $1 where id = $2'

        poolWrite.query(sql, [skinColorsCode, userId]);
        res.status(200).json({
            error: 0,
            msg: 'Set skinColors thanh cong'
        })


    } catch (e) {
        console.log('[Error]:putUsersSkinColors:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}

const postUsersEnemies = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        let enemyCode = req.body.enemyCode;
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId]

        if (enemyCode == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'enemyCode Invalid'
            })
            return
        }

        //Xem co dung action trong nhiem vu nhan pet ko
        if (user.currentAction.actionType != 22) {
            res.status(400).json({
                error: 1,
                msg: 'actionCode khong dung'
            })
            return
        }

        //Check xem enemyCode do ton tai khong
        let enemyPicked = vlr.enemies[enemyCode]
        if (enemyPicked == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'enemyCode khong ton tai'
            })
            return
        }
        //Cho vao my pet
        let studentEnemySql = 'insert into student_enemy (evolution_level, enemy_code, level, student_id) values ($1, $2, $3, $4) returning id, evolution_level, level'
        poolWrite.query(studentEnemySql, [1, enemyCode, 1, userId]).then(data => {
            if (data.rowCount < 1) {
                res.status(502).json({
                    error: 1,
                    msg: 'Service Error'
                })
                return
            }

            let petRecord = data.rows[0];

            if (user.myPets == undefined) {
                user.myPets = {}
            }
            let pet = {
                enemyId: petRecord.id,
                evolutionLevel: petRecord.evolution_level,
                level: petRecord.level,
                enemyCode: enemyCode,
                exp: 0
            }
            user.myPets[pet.enemyId] = pet;
            user.petId = pet.enemyId;

            //Cho vao my team
            let studentTeamSql = 'insert into student_team (enemy_id, student_id, index) values ($1, $2, $3)';
            poolWrite.query(studentTeamSql, [pet.enemyId, userId, 1]);

            if (user.myTeam == undefined) {
                user.myTeam = {};
            }
            let teamMember = {
                enemyId: pet.enemyId,
                index: 1
            }
            user.myTeam[teamMember.enemyId] = teamMember;


            //Set quai di theo
            common.checkPetFollowing(vlr, userId);


            let studentPetIdSql = 'update student set pet_id = $1 where id = $2';
            poolWrite.query(studentPetIdSql, [pet.enemyId, userId]);
            common.updateActionStatus(vlr, userId, poolWrite).then(data => {
                // Cap nhat lai du lieu cho user
                user.currentActionCode = data.nextActionCode;
                user.currentTaskCode = data.nextTaskCode;
                delete user.currentAction;
                delete user.currentTask;
                user.currentAction = vlr.actions.full[data.nextActionCode];
                user.currentTask = vlr.tasks[data.nextTaskCode];
                // Cap nhat db
                let sql = 'update student set current_task_code = $1, current_action_code = $2 where id = $3';
                poolWrite.query(sql, [user.currentTaskCode, user.currentActionCode, userId]);

                if (user.currentAction.actionType == 18) {
                    common.checkActionLevelUp(vlr, userId, poolWrite).then(dataLevel => {
                        res.status(200).json({
                            error: 0,
                            msg: 'Cap nhat thanh cong',
                            Status: dataLevel.status,
                            prize: dataLevel.prize,
                            currentTask: user.currentTask,
                            currentAction: user.currentAction,
                        })
                        return
                    }).catch(errorLevel => {
                        console.log("Loi trong qua trinh update:", errorLevel);
                        res.status(502).json({
                            error: 1,
                            msg: 'Service Error'
                        })
                    })
                    return
                }

                // Send to client
                if (user.currentAction.actionType == 18) {
                    common.checkActionLevelUp(vlr, userId, poolWrite).then(dataLevel => {
                        res.status(200).json({
                            error: 0,
                            msg: 'Cap nhat thanh cong',
                            Status: dataLevel.status,
                            prize: dataLevel.prize,
                            currentTask: user.currentTask,
                            currentAction: user.currentAction,
                        })
                        return
                    }).catch(errorLevel => {
                        console.log("Loi trong qua trinh update:", errorLevel);
                        res.status(502).json({
                            error: 1,
                            msg: 'Service Error'
                        })
                    })
                    return
                }

                res.status(200).json({
                    error: 0,
                    msg: 'Cap nhat thanh cong',
                    Status: data.status,
                    prize: data.prize,
                    currentTask: user.currentTask,
                    currentAction: user.currentAction,
                    enemyInfo: enemyPicked,
                    enemyDetail: pet,
                })
            }).catch(error => {
                console.log("Loi trong qua trinh update:", error);
                res.status(502).json({
                    error: 1,
                    msg: 'Service Error'
                })
            })
        }).catch(e => {
            console.log('[Error]:postUsersEnemies - studentEnemySql:', e);
            res.status(502).json({
                error: 1,
                msg: 'Service Error'
            })
            return
        });
    } catch (e) {
        console.log('[Error]:postUsersEnemies:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}

const postUsersEnemiesBattles = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId];
        let enemyId = req.body.enemyId;

    } catch (e) {
        console.log('[Error]:postUsersEnemiesBattles:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}

const postHumansBattles = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        // La mot cai offer
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId]
        let areaCode = user.areaCode;
        let roomUsers = (vlr.areas != undefined) && (vlr.areas[areaCode] != undefined) ? vlr.areas[areaCode].listUsers : undefined;

        if (roomUsers == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'Du lieu dau vao loi'
            })
            return;
        }
        let otherUserId = req.body.otherUserId;
        let offer = {};
        let otherId;
        if (otherUserId == undefined) {
            // Offer ngau nhien
            let memberAvlb = [];
            let i;
            for (i in roomUsers) {
                let y = vlr.listUsers[i];
                if (i != userId && y.enemyBattleId != undefined && y.humanBattelId && y.bossBattelId) {
                    memberAvlb.push(i);
                }
            }
            // Kiem tra danh sach

            if (memberAvlb.length < 1) {
                // Todo tra lai khong co thang nao het
            } else if (memberAvlb.length < 2) {
                otherId = memberAvlb[0];

            } else { // Lon hon 1 thang
                otherId = memberAvlb[common.getRndInteger(0, memberAvlb.length)];

            }
        } else {
            // Offer mot nguoi cu the
            otherId = otherUserId;
        }
        if (roomUsers[otherId] == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'Nguoi nay da thoat khoi area'
            })
            return
        }
        // Neu co thuc hien lay thong tin nguoi do
        let otherUser = vlr.listUsers[otherId];
        // Kiem tra xem thang nay co dang danh nhau gi khong
        if (otherUser.enemyBattleId == undefined && otherUser.humanBattleId == undefined && otherUser.bossBattleId == undefined) {
            // Tao ma offer roi tao offer roi gui offer
            let offerId = userId + '_' + otherId + '_' + Date.now();
            offer.offerId = offerId;
            offer.attacker = userId;
            offer.attacked = otherId;
            offer.refreshTime = Date.now();
            offer.status = 0;
            // Cai dat time out
            vlr.listOffers[offerId] = offer;
            // Gui loi khieu chien den ban nay
            // Dong goi thong tin de gui cho thang duoc khieu chien cho no biet
            io.to(vlr.listUsers[otherId].socketid).emit('u_offer', {
                battleId: offerId,
                userId: userId,
                name: vlr.listUsers[userId].name
            })
            res.status(200).json({
                error: 0,
                msg: 'Da tao offer thanh cong',
                battleId: offerId
            })

        } else {
            res.status(200).json({
                error: 1,
                msg: 'No ban danh nhau voi nguoi khac roi'
            })

        }

    } catch (e) {
        console.log('[Error]:postHumansBattles:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}

const putHumansBattles = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        let userId = parseInt(req.headers['userid']); // Nguoi duoc khieu chien tra loi
        let user = vlr.listUsers[userId]
        let areaCode = user.areaCode;
        let battleId = req.body.battleId;
        let result = req.body.result;

        if (battleId == undefined) {
            // Sai du lieu dau vao
            res.status(400).json({
                error: 1,
                msg: 'Thieu battleId'
            })
            return;
        }
        let offer = vlr.listOffers[battleId];
        if (offer == undefined) {

            res.status(400).json({
                error: 1,
                msg: 'Thieu battleId'
            })
            return;

        }
        let attacker = vlr.listUsers[offer.attacker];
        if (result == undefined || result == 0) {
            // Kho tiep chien
            // Xoa timer
            // Xoa offer
            delete vlr.listOffers[battleId];
            // Bao cho nguoi kia biet thang nay no so chet khong dam choi
            io.to(attacker.socketid).emit('u_offer_reject', {
                battleId: offerId,
                userId: userId
            })
            res.status(200).json({
                error: 0,
                msg: 'Tra loi thanh cong'
            })
            return
        }
        let roomUsers = (vlr.areas != undefined) && (vlr.areas[areaCode] != undefined) ? vlr.areas[areaCode].listUsers : undefined;
        if (roomUsers == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'Du lieu dau vao loi'
            })
            return;
        }
        // Kiem tra xem no danh nhau vs ai chua, con cung room khong
        if (attacker.enemyBattleId == undefined && attacker.humanBattleId == undefined && attacker.bossBattleId == undefined && attacker.areaCode == areaCode) {
            // Danh nhau
            // Tao cuoc chien
            let humanBattle = {
                battleId: offer.offerId,
                attacker: offer.attacker,
                attacked: offer.attacked,
                refreshTime: Date.now()
            }
            offer.status = 1;
            // Xoa offer
            delete vlr.listOffers[battleId];
            // Thiet lap timer cho hummanBattle
            vlr.listHumanBattles[humanBattle.battleId] = humanBattle;
            // set thong tin cuoc chien cho tung nguoi
            vlr.listUsers[humanBattle.attacker].humanBattleId = humanBattle.battleId;
            vlr.listUsers[humanBattle.attacked].humanBattleId = humanBattle.battleId;
            // remove from room
            let i;
            for (i in roomUsers) {
                if (i == humanBattle.attacker || i == humanBattle.attacked) {
                    // Da ton tai thong tin o day thi khong lam gi
                } else {
                    // Gui thong bao di chuyen
                    io.to(vlr.listUsers[i].socketid).emit('u_user_remove', { userId: humanBattle.attacker });
                    io.to(vlr.listUsers[i].socketid).emit('u_user_remove', { userId: humanBattle.attacked });
                }

            }
            // Lay thong tin cua 2 thang dong goi vao tran chien
            let attackerUser = {
                userId: vlr.listUsers[humanBattle.attacker].userId,
                hatCode: vlr.listUsers[humanBattle.attacker].hatCode,
                wandCode: vlr.listUsers[humanBattle.attacker].wandCode,
                outfitsCode: vlr.listUsers[humanBattle.attacker].outfitsCode,
                bootCode: vlr.listUsers[humanBattle.attacker].bootCode,
                ringCode: vlr.listUsers[humanBattle.attacker].ringCode,
                createdAt: vlr.listUsers[humanBattle.attacker].createdAt,
                px: vlr.listUsers[humanBattle.attacker].px,
                py: vlr.listUsers[humanBattle.attacker].py,
                name: vlr.listUsers[humanBattle.attacker].name,
                grade: vlr.listUsers[humanBattle.attacker].grade,
                gender: vlr.listUsers[humanBattle.attacker].gender,
                language: vlr.listUsers[humanBattle.attacker].language,
                hairStyle: vlr.listUsers[humanBattle.attacker].hairStyle,
                hairColor: vlr.listUsers[humanBattle.attacker].hairColor,
                skinColor: vlr.listUsers[humanBattle.attacker].skinColor,
                lastLogin: vlr.listUsers[humanBattle.attacker].lastLogin,
                exp: vlr.listUsers[humanBattle.attacker].exp,
                level: vlr.listUsers[humanBattle.attacker].level,
                mana: vlr.listUsers[humanBattle.attacker].mana,
                petId: vlr.listUsers[humanBattle.attacker].petId
            }
            let attackerItems = []; // Lay danh sach item
            for (i in vlr.listUsers[attackerUser.userId].myGoods) {
                let y = vlr.listUsers[attackerUser.userId].myGoods[i];
                if (y.use == 1) {
                    attackerItems.push(y)
                }

            }
            attackerUser.items = attackerItems;
            // lay them item use
            // Lay thong tin team
            let attackerTotalHealth = 0;
            let attackerTeam = {};
            // Cac thong tin can thiet
            attackerTeam.userId = humanBattle.attacker;
            attackerTeam.mana = attackerUser.mana == undefined ? 0 : attackerUser.mana;
            //attackerTeam.currentHealth = currentHealth;
            //attackerTeam.totalHealth = totalHealth;
            attackerTeam.noiThuong = [];
            attackerTeam.phongThu = [];
            attackerTeam.attackerId = attackerUser.petId;
            attackerTeam.lostTurn = 0;
            //attackerTeam.listMembers = listMembers;
            // Tinh toan health va member
            let listAttackerMembers = {};
            for (i in vlr.listUsers[attackerUser.userId].myTeam) {
                let y = vlr.listUsers[attackerUser.userId].myTeam[i];
                let member = {
                    enemyId: y.enemyId,
                    totalHealth: vlr.enemies[vlr.listUsers[humanBattle.attacker].myPets[y.enemyId].enemyCode].baseHealth * vlr.listUsers[humanBattle.attacker].myPets[y.enemyId].level,
                    currentHealth: vlr.enemies[vlr.listUsers[humanBattle.attacker].myPets[y.enemyId].enemyCode].baseHealth * vlr.listUsers[humanBattle.attacker].myPets[y.enemyId].level,
                    noiThuong: [], // Neu co thi giam 1
                    phongThu: [], // Neu co thi giam 1
                    dam: vlr.enemies[vlr.listUsers[humanBattle.attacker].myPets[y.enemyId].enemyCode].baseDame * vlr.listUsers[humanBattle.attacker].myPets[y.enemyId].level,
                    enemyCode: vlr.listUsers[humanBattle.attacker].myPets[y.enemyId].enemyCode,
                    elementCode: vlr.enemies[vlr.listUsers[humanBattle.attacker].myPets[y.enemyId].enemyCode].elementCode,
                    evolutionLevel: vlr.listUsers[humanBattle.attacker].myPets[y.enemyId].evolutionLevel,
                    level: vlr.listUsers[humanBattle.attacker].myPets[y.enemyId].level,
                    nameEn: vlr.enemies[vlr.listUsers[humanBattle.attacker].myPets[y.enemyId].enemyCode].nameEn,
                    nameVn: vlr.enemies[vlr.listUsers[humanBattle.attacker].myPets[y.enemyId].enemyCode].nameVn,
                    infoVn: vlr.enemies[vlr.listUsers[humanBattle.attacker].myPets[y.enemyId].enemyCode].infoVn,
                    infoEn: vlr.enemies[vlr.listUsers[humanBattle.attacker].myPets[y.enemyId].enemyCode].infoEn,
                    infoEnVoice: vlr.enemies[vlr.listUsers[humanBattle.attacker].myPets[y.enemyId].enemyCode].infoEnVoice,
                    infoVnVoice: vlr.enemies[vlr.listUsers[humanBattle.attacker].myPets[y.enemyId].enemyCode].infoVnVoice,
                    status: 1,
                    wasInBattle: 0,
                    listSkill: common.getListSkill(vlr, vlr.enemies[vlr.listUsers[humanBattle.attacker].myPets[y.enemyId].enemyCode].elementCode, vlr.listUsers[humanBattle.attacker].myPets[y.enemyId].evolutionLevel, vlr.listUsers[humanBattle.attacker].myPets[y.enemyId].level, attackerTeam.mana)
                }
                listAttackerMembers[member.enemyId] = member;
                attackerTotalHealth = attackerTotalHealth + member.totalHealth;
            }
            attackerTeam.totalHealth = attackerTotalHealth;
            attackerTeam.currentHealth = attackerTotalHealth;
            attackerTeam.listMembers = listAttackerMembers;
            if (humanBattle.team == undefined) {
                humanBattle.team = {};
            }
            humanBattle.team[attackerTeam.userId] = attackerTeam;
            console.log('team:', humanBattle.team);

            let attackedUser = {
                userId: vlr.listUsers[humanBattle.attacked].userId,
                hatCode: vlr.listUsers[humanBattle.attacked].hatCode,
                wandCode: vlr.listUsers[humanBattle.attacked].wandCode,
                outfitsCode: vlr.listUsers[humanBattle.attacked].outfitsCode,
                bootCode: vlr.listUsers[humanBattle.attacked].bootCode,
                ringCode: vlr.listUsers[humanBattle.attacked].ringCode,
                createdAt: vlr.listUsers[humanBattle.attacked].createdAt,
                px: vlr.listUsers[humanBattle.attacked].px,
                py: vlr.listUsers[humanBattle.attacked].py,
                name: vlr.listUsers[humanBattle.attacked].name,
                grade: vlr.listUsers[humanBattle.attacked].grade,
                gender: vlr.listUsers[humanBattle.attacked].gender,
                language: vlr.listUsers[humanBattle.attacked].language,
                hairStyle: vlr.listUsers[humanBattle.attacked].hairStyle,
                hairColor: vlr.listUsers[humanBattle.attacked].hairColor,
                skinColor: vlr.listUsers[humanBattle.attacked].skinColor,
                lastLogin: vlr.listUsers[humanBattle.attacked].lastLogin,
                exp: vlr.listUsers[humanBattle.attacked].exp,
                level: vlr.listUsers[humanBattle.attacked].level,
                mana: vlr.listUsers[humanBattle.attacked].mana,
                petId: vlr.listUsers[humanBattle.attacked].petId
            }
            // Lay thong tin team cho attacked
            // lay danh sach item use de tra cho kien

            let attackedItems = []; // Lay danh sach item
            for (i in vlr.listUsers[attackedUser.userId].myGoods) {
                let y = vlr.listUsers[attackedUser.userId].myGoods[i];
                if (y.use == 1) {
                    attackedItems.push(y)
                }

            }
            attackedUser.items = attackedItems;
            // lay them item use
            // Lay thong tin team
            let attackedTotalHealth = 0;
            let attackedTeam = {};
            // Cac thong tin can thiet
            attackedTeam.userId = humanBattle.attacked;
            attackedTeam.mana = attackedUser.mana == undefined ? 0 : attackedUser.mana;
            //attackerTeam.currentHealth = currentHealth;
            //attackerTeam.totalHealth = totalHealth;
            attackedTeam.noiThuong = [];
            attackedTeam.phongThu = [];
            attackedTeam.attackerId = attackedUser.petId;
            attackedTeam.lostTurn = 0;
            //attackerTeam.listMembers = listMembers;
            // Tinh toan health va member
            let listAttackedMembers = {};

            for (i in vlr.listUsers[attackedUser.userId].myTeam) {
                let y = vlr.listUsers[attackedUser.userId].myTeam[i];
                let member = {
                    enemyId: y.enemyId,
                    totalHealth: vlr.enemies[vlr.listUsers[humanBattle.attacked].myPets[y.enemyId].enemyCode].baseHealth * vlr.listUsers[humanBattle.attacked].myPets[y.enemyId].level,
                    currentHealth: vlr.enemies[vlr.listUsers[humanBattle.attacked].myPets[y.enemyId].enemyCode].baseHealth * vlr.listUsers[humanBattle.attacked].myPets[y.enemyId].level,
                    noiThuong: [], // Neu co thi giam 1
                    phongThu: [], // Neu co thi giam 1
                    dam: vlr.enemies[vlr.listUsers[humanBattle.attacked].myPets[y.enemyId].enemyCode].baseDame * vlr.listUsers[humanBattle.attacked].myPets[y.enemyId].level,
                    enemyCode: vlr.listUsers[humanBattle.attacked].myPets[y.enemyId].enemyCode,
                    elementCode: vlr.enemies[vlr.listUsers[humanBattle.attacked].myPets[y.enemyId].enemyCode].elementCode,
                    evolutionLevel: vlr.listUsers[humanBattle.attacked].myPets[y.enemyId].evolutionLevel,
                    level: vlr.listUsers[humanBattle.attacked].myPets[y.enemyId].level,
                    nameEn: vlr.enemies[vlr.listUsers[humanBattle.attacked].myPets[y.enemyId].enemyCode].nameEn,
                    nameVn: vlr.enemies[vlr.listUsers[humanBattle.attacked].myPets[y.enemyId].enemyCode].nameVn,
                    infoVn: vlr.enemies[vlr.listUsers[humanBattle.attacked].myPets[y.enemyId].enemyCode].infoVn,
                    infoEn: vlr.enemies[vlr.listUsers[humanBattle.attacked].myPets[y.enemyId].enemyCode].infoEn,
                    infoEnVoice: vlr.enemies[vlr.listUsers[humanBattle.attacked].myPets[y.enemyId].enemyCode].infoEnVoice,
                    infoVnVoice: vlr.enemies[vlr.listUsers[humanBattle.attacked].myPets[y.enemyId].enemyCode].infoVnVoice,
                    status: 1,
                    wasInBattle: 0,
                    listSkill: common.getListSkill(vlr, vlr.enemies[vlr.listUsers[humanBattle.attacked].myPets[y.enemyId].enemyCode].elementCode, vlr.listUsers[humanBattle.attacked].myPets[y.enemyId].evolutionLevel, vlr.listUsers[humanBattle.attacked].myPets[y.enemyId].level, attackedTeam.mana)
                }
                listAttackedMembers[member.enemyId] = member;
                attackedTotalHealth = attackedTotalHealth + member.totalHealth;
            }
            attackedTeam.totalHealth = attackedTotalHealth;
            attackedTeam.currentHealth = attackedTotalHealth;
            attackedTeam.listMembers = listAttackedMembers;
            if (humanBattle.team == undefined) {
                humanBattle.team = {};
            }
            humanBattle.team[attackedTeam.userId] = attackedTeam;
            console.log('team:', humanBattle.team);
            console.log('myTeam:', attackerTeam);
            console.log('otherTeam:', attackedTeam);
            io.to(vlr.listUsers[attackerUser.userId].socketid).emit('u_offer_acepted', {
                battleId: humanBattle.battleId, // Todo Phai kem theo thong tin cua 2 team de buid teamn
                myInfo: attackerUser,
                myTeam: attackerTeam,
                otherInfo: attackedUser,
                otherTeam: attackedTeam,
                currentQuestion: vlr.listUsers[attackerUser.userId].currentQuestion
            });
            // Todo Thuc hien notify cho thang con lai ve thong tin tran danh


            io.to(vlr.listUsers[attackedUser.userId].socketid).emit('u_offer_acepted', {
                battleId: humanBattle.battleId, // Todo Phai kem theo thong tin cua 2 team de buid teamn
                myInfo: attackedUser,
                myTeam: attackedTeam,
                otherInfo: attackerUser,
                otherTeam: attackerTeam,
                currentQuestion: vlr.listUsers[attackedUser.userId].currentQuestion
            });


            res.status(200).json({
                error: 0,
                msg: 'Tran danh da duoc chap nhan',
                battleId: humanBattle.battleId, // Todo Phai kem theo thong tin cua 2 team de buid teamn
                myInfo: attackedUser,
                myTeam: attackedTeam,
                otherInfo: attackerUser,
                otherTeam: attackerTeam
            })
        } else {
            // Xoa offer
            delete vlr.listOffers[battleId];
            res.status(200).json({
                error: 1,
                msg: 'No bo chon roi khong dam danh nua'
            })
        }
    } catch (e) {
        console.log('[Error]:putHumansBattles:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}

const postBossesBattles = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {

    } catch (e) {
        console.log('[Error]:postBossesBattles:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}

const getHouses = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:getHouses:');

        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId];

        let allHouses = vlr.houses
        let userHousesCode = Object.keys(user.houses);
        let currentHouse = user.currentHouse;


        for (i in allHouses) {
            if (userHousesCode.includes(i)) {
                if (i == currentHouse) {
                    allHouses[i].owned = 1;
                    allHouses[i].using = 1;
                    continue;
                }
                allHouses[i].owned = 1;
                allHouses[i].using = 0;
            } else {
                allHouses[i].owned = 0;
                allHouses[i].using = 0;
            }
        }

        res.status(200).json({
            error: 0,
            msg: 'OK',
            houses: allHouses
        })
    } catch (e) {
        console.log('[Error]:getHouses:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}

const putUsersHouses = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:putUsersHouses:');

        let houseCode = req.body.houseCode;
        let allHouses = vlr.houses;

        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId];
        let userFurniture = user.houseFurniture;
        let userMoney = user.money.amount;



        if (houseCode == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'houseCode invalid'
            })
            return
        }

        if (allHouses[houseCode] == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'houseCode invalid'
            })
            return
        }

        let housePrice = allHouses[houseCode].price;

        //Khong so Huu
        if (user.houses[houseCode] == undefined) {
            if (userMoney < housePrice) {
                res.status(200).json({
                    error: 1,
                    msg: 'ban khong du tien de mua can nha nay'
                })
                return
            }
            //Thuc hien mua
            //Tru tien trong vlr va DB
            user.money.amount -= housePrice;

            let sqlStudentMoney = 'update student_money set amount = amount - $1 where student_id = $2'
            poolWrite.query(sqlStudentMoney, [housePrice, userId]);

            //Add nha vao vlr va DB
            let sqlStudentHouse = 'insert into student_house (house_code, student_id) values ($1, $2) returning id'
            poolWrite.query(sqlStudentHouse, [houseCode, userId]).then(data => {
                user.houses[houseCode] = {
                    houseId: data.rows[0].id,
                    houseCode: houseCode
                }
            }).catch(error => {
                console.log('Loi khi putUsersHouses insert student house:', error)
            })
        }
        //Co so huu
        //Check xem co dang dung khong
        if (houseCode == user.currentHouse) {
            res.status(200).json({
                error: 0,
                msg: 'Ban dang dung nha nay roi'
            })
            return
        }

        //Set current_house o vlr va update database
        user.currentHouse = houseCode;
        let sqlCurrentHouse = 'update student set current_house = $1 where id = $2'
        poolWrite.query(sqlCurrentHouse, [houseCode, userId]);

        //Reset vi tri furniture
        for (i in userFurniture) {
            delete userFurniture[i].positionX;
            delete userFurniture[i].positionY;
        }

        let sqlResetFurniturePosition = 'update house_furniture set p_x = null, p_y =  null where student_id = $1;'
        poolWrite.query(sqlResetFurniturePosition, [userId]);

        res.status(200).json({
            error: 0,
            msg: 'putUsersHouses thanh cong'
        })


    } catch (e) {
        console.log('[Error]:putUsersHouses:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}

const putUsersGoodsPicked = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        // Do co 3 loai: area, task, action
        // Neu do theo area thi chi can thuc hien cap nhat student area
        // Neu do theo task va action thi thuc hien cap nhat them task
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId];
        let goodsId = req.body.goodsId;
        if (goodsId == undefined) {
            console.log('Sai du lieu');
            res.status(400).json({
                error: 1,
                msg: 'Goods invalid'
            })
            return;
        }
        let goodsFull = vlr.areaGoods.full[goodsId];
        if (goodsFull == undefined) {
            console.log('Sai du lieu');
            res.status(400).json({
                error: 1,
                msg: 'Goods invalid'
            })
            return;
        }
        // Thuc hien tao student area
        // insert vao DB de lay goodsId
        let sql = 'insert into student_goods(goods_code, count , student_id ) values ($1, 1, $2)  ON CONFLICT (goods_code , student_id) DO UPDATE SET count = student_goods.count + 1 returning id';
        poolWrite.query(sql, [goodsFull.goodsCode, userId]).then(data => {
            // Cap nhat VLR
            let goodsStudentId = data.rows[0];
            let goodsStudent = {
                goodsId: goodsStudentId.id,
                goodsCode: goodsFull.goodsCode,
                count: 1
            }
            if (vlr.listUsers[userId].myGoods[goodsFull.goodsCode] == undefined) {
                vlr.listUsers[userId].myGoods[goodsFull.goodsCode] = goodsStudent
            } else {
                vlr.listUsers[userId].myGoods[goodsFull.goodsCode].count = vlr.listUsers[userId].myGoods[goodsFull.goodsCode].count + 1;
            }
            if (goodsFull.type == 0) {
                // Area
                //Todo Thuc hien an no di mot khoang thoi gian
                res.status(200).json({
                    error: 0,
                    msg: 'Thanh cong',
                    goodsId: goodsId
                })
            } else {
                // Task or action
                console.log('putUsersGoodsPicked:', user.currentAction)

                if (user.currentAction.actionType == 7) {
                    let finishAction = false;
                    let i;
                    for (i in user.currentAction.relation) {
                        if (user.currentAction.relation[i].relationCode == goodsFull.goodsCode && user.currentAction.relation[i].relationCount <= vlr.listUsers[userId].myGoods[goodsFull.goodsCode].count) {
                            finishAction = true;
                        } else {
                            finishAction = false;
                        }
                    }

                    // Kiem tra xem neu hoan thanh duoc cong viec
                    if (finishAction == true) {
                        // Hoan thanh thuc hien cap nhat task
                        common.updateActionStatus(vlr, userId, poolWrite).then(data => {
                            // Cap nhat lai du lieu cho user
                            user.currentActionCode = data.nextActionCode;
                            user.currentTaskCode = data.nextTaskCode;
                            delete user.currentAction;
                            delete user.currentTask;
                            user.currentAction = vlr.actions.full[data.nextActionCode];
                            user.currentTask = vlr.tasks[data.nextTaskCode];
                            // Cap nhat db
                            let sql = 'update student set current_task_code = $1, current_action_code = $2 where id = $3';
                            poolWrite.query(sql, [user.currentTaskCode, user.currentActionCode, userId]);
                            if (user.currentAction.actionType == 18) {
                                common.checkActionLevelUp(vlr, userId, poolWrite).then(dataLevel => {
                                    res.status(200).json({
                                        error: 0,
                                        msg: 'Cap nhat thanh cong',
                                        Status: dataLevel.status,
                                        prize: dataLevel.prize,
                                        goodsId: goodsId,
                                        currentTask: user.currentTask,
                                        currentAction: user.currentAction,
                                    })
                                    return
                                }).catch(errorLevel => {
                                    console.log("Loi trong qua trinh update:", errorLevel);
                                    res.status(502).json({
                                        error: 1,
                                        msg: 'Service Error'
                                    })
                                })
                                return
                            }


                            // Send to client
                            res.status(200).json({
                                error: 0,
                                msg: 'Cap nhat thanh cong',
                                Status: data.status,
                                prize: data.prize,
                                goodsId: goodsId,
                                currentTask: user.currentTask,
                                currentAction: user.currentAction
                            })
                        }).catch(error => {
                            console.log("Loi trong qua trinh update:", error);
                            res.status(502).json({
                                error: 1,
                                msg: 'Service Error'
                            })
                        })
                    } else {
                        res.status(200).json({
                            error: 0,
                            goodsId: goodsId,
                            msg: 'Thanh cong'
                        })
                    }
                } else {
                    res.status(200).json({
                        error: 0,
                        goodsId: goodsId,
                        msg: 'Thanh cong'
                    })
                }
            }
        }).catch(error => {
            console.log('[Error]:Loi update good pick:', error);
            res.status(502).json({
                error: 1,
                msg: 'Service Error'
            })


        });
        // Kiem tra xem day la goods cua area hay cua task/ action

    } catch (e) {
        console.log('[Error]:postUsersGoodsPicked:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}



const postUsersGoods = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:postUsersGoods:');

        let goodsCode = req.body.goodsCode;
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId];
        let userMoney = user.money.amout;
        if (goodsCode == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'goodsCode invalid'
            })
            return
        }
        //Kiem tra goods ton tai khong
        if (vlr.goods[goodsCode] == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'goodsCode invalid'
            })
            return
        }
        let goods = vlr.goods[goodsCode]
        if (userMoney < goods.price) {
            res.status(200).json({
                error: 1,
                msg: 'Ban khong du tien de mua goods'
            })
            return
        }

        //Tru tien = gia cua goods
        user.money.amount = user.money.amount - goods.price;
        let sqlStudentMoney = 'update student_money set amount = amount - $1 where student_id = $2';
        poolWrite.query(sqlStudentMoney, [goods.price, userId]);

        //Chua co goods, khoi tao, update vlr va DB
        if (user.myGoods[goodsCode] == undefined) {
            let sqlAddGoods = 'insert into student_goods (goods_code, count, student_id) values ($1, 1, $2) returning id'
            poolWrite.query(sqlAddGoods, [goodsCode, userId]).then(data => {
                user.myGoods[goodsCode] = {
                    goodsId: data.rows[0].id,
                    goodsCode: goodsCode,
                    count: 1
                }
            }).catch(error => {
                console.log('Loi khi postUsersGoods insert db:', error)
            })
            if (user.currentAction.actionType == 6) {
                let i;
                let actionFinished = false;
                for (i in user.currentAction.relation) {
                    if (goodsCode == user.currentAction.relation[i].relationCode && user.myGoods[goodsCode].count >= user.currentAction.relation[i].relationCount) {
                        actionFinished = true;
                    } else {
                        actionFinished = false;
                    }
                }
                if (actionFinished == true) {
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

                        if (user.currentAction.actionType == 18) {
                            common.checkActionLevelUp(vlr, userId, poolWrite).then(dataLevel => {
                                res.status(200).json({
                                    error: 0,
                                    msg: 'Cap nhat thanh cong',
                                    Status: dataLevel.status,
                                    prize: dataLevel.prize,
                                    currentTask: user.currentTask,
                                    currentAction: user.currentAction,
                                })
                                return
                            }).catch(errorLevel => {
                                console.log("Loi trong qua trinh update:", errorLevel);
                                res.status(502).json({
                                    error: 1,
                                    msg: 'Service Error'
                                })
                            })
                            return
                        }

                        // Send to client
                        res.status(200).json({
                            error: 0,
                            msg: 'Cap nhat thanh cong',
                            Status: data.status,
                            prize: data.prize,
                            currentTask: user.currentTask,
                            currentAction: user.currentAction,
                            taskEnemies: data.taskEnemies != undefined ? data.taskEnemies : [],
                            taskGoods: data.taskGoods != undefined ? data.taskGoods : [],
                            taskEvents: data.taskEvents != undefined ? data.taskEvents : [],
                            taskNPCs: data.taskNPCs != undefined ? data.taskNPCs : [],
                            actionEnemies: data.actionEnemies != undefined ? data.actionEnemies : [],
                            actionGoods: data.actionGoods != undefined ? data.actionGoods : [],
                            actionEvents: data.actionEvents != undefined ? data.actionEvents : [],
                            actionNPCs: data.actionNPCs != undefined ? data.actionNPCs : []
                        })
                    }).catch(error => {
                        console.log("Loi trong qua trinh update:", error);
                        res.status(502).json({
                            error: 1,
                            msg: 'Service Error'
                        })
                    })
                } else {
                    res.status(200).json({
                        error: 0,
                        msg: 'postUsersGoods thanh cong'
                    })
                }
            } else {
                res.status(200).json({
                    error: 0,
                    msg: 'postUsersGoods thanh cong'
                })
            }
        } else {
            //Neu da co goods, cong 1 vao count, update vlr va DB
            user.myGoods[goodsCode].count += 1;
            let sqlAddGoodsExisted = 'update student_goods set count = count + 1 where id = $1';
            poolWrite.query(sqlAddGoodsExisted, [user.myGoods[goodsCode].goodsId]);

            if (user.currentAction.actionType == 6) {
                let i;
                let actionFinished = false;
                for (i in user.currentAction.relation) {
                    if (goodsCode == user.currentAction.relation[i].relationCode && user.myGoods[goodsCode].count >= user.currentAction.relation[i].relationCount) {
                        actionFinished = true;
                    } else {
                        actionFinished = false;
                    }
                }
                if (actionFinished == true) {
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

                        if (user.currentAction.actionType == 18) {
                            common.checkActionLevelUp(vlr, userId, poolWrite).then(dataLevel => {
                                res.status(200).json({
                                    error: 0,
                                    msg: 'Cap nhat thanh cong',
                                    Status: dataLevel.status,
                                    prize: dataLevel.prize,
                                    currentTask: user.currentTask,
                                    currentAction: user.currentAction,
                                })
                                return
                            }).catch(errorLevel => {
                                console.log("Loi trong qua trinh update:", errorLevel);
                                res.status(502).json({
                                    error: 1,
                                    msg: 'Service Error'
                                })
                            })
                            return
                        }

                        // Send to client
                        res.status(200).json({
                            error: 0,
                            msg: 'Cap nhat thanh cong',
                            Status: data.status,
                            prize: data.prize,
                            currentTask: user.currentTask,
                            currentAction: user.currentAction,
                            taskEnemies: data.taskEnemies != undefined ? data.taskEnemies : [],
                            taskGoods: data.taskGoods != undefined ? data.taskGoods : [],
                            taskEvents: data.taskEvents != undefined ? data.taskEvents : [],
                            taskNPCs: data.taskNPCs != undefined ? data.taskNPCs : [],
                            actionEnemies: data.actionEnemies != undefined ? data.actionEnemies : [],
                            actionGoods: data.actionGoods != undefined ? data.actionGoods : [],
                            actionEvents: data.actionEvents != undefined ? data.actionEvents : [],
                            actionNPCs: data.actionNPCs != undefined ? data.actionNPCs : []
                        })
                    }).catch(error => {
                        console.log("Loi trong qua trinh update:", error);
                        res.status(502).json({
                            error: 1,
                            msg: 'Service Error'
                        })
                    })
                } else {
                    res.status(200).json({
                        error: 0,
                        msg: 'postUsersGoods thanh cong'
                    })
                }
            } else {
                res.status(200).json({
                    error: 0,
                    msg: 'postUsersGoods thanh cong'
                })
            }
        }
    } catch (e) {
        console.log('[Error]:postUsersGoods:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}

const putHousesFurniture = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:putHousesFurniture:');

        let goodsCode = req.body.goodsCode;
        let positionX = req.body.positionX;
        let positionY = req.body.positionY;

        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId];

        if (goodsCode == undefined || positionX == undefined || positionY == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'goodsCode or posX, posY invalid'
            })
            return
        }

        if (user.houseFurniture[goodsCode] == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'Ban khong so huu mon do nay'
            })
            return
        }

        user.houseFurniture[goodsCode].positionX = positionX;
        user.houseFurniture[goodsCode].positionY = positionY;

        //update vao DB
        let updatePosSql = 'update house_furniture set p_x = $1, p_y =  $2 where id = $3';

        let furnitureId = user.houseFurniture[goodsCode].furnitureId;
        poolWrite.query(updatePosSql, [positionX, positionY, furnitureId]);

        res.status(200).json({
            error: 0,
            msg: 'putHousesFurniture thanh cong',
        })

    } catch (e) {
        console.log('[Error]:putHousesFurniture:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}

const postUsersTameEnemies = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:postUsersTameEnemies:');

        let enemyId = req.body.enemyId;
        let enemyCode = req.body.enemyCode;
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId]

        if (enemyId == undefined || enemyCode == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'enemyCode Invalid'
            })
            return
        }

        //Check xem enemyCode do ton tai khong
        if (vlr.enemies[enemyCode] == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'enemyCode khong ton tai'
            })
            return
        }
        //Cho vao my pet
        let studentEnemySql = 'insert into student_enemy (evolution_level, enemy_code, level, student_id) values ($1, $2, $3, $4) returning id, evolution_level, level'
        poolWrite.query(studentEnemySql, [vlr.areaEnemies.full[enemyId].evolutionLevel, enemyCode, 1, userId]).then(data => {
            if (data.rowCount < 1) {
                res.status(502).json({
                    error: 1,
                    msg: 'Service Error'
                })
                return
            }

            let petRecord = data.rows[0];
            if (user.myPets == undefined) {
                user.myPets = {}
            }
            let pet = {
                enemyId: petRecord.id,
                evolutionLevel: petRecord.evolution_level,
                level: petRecord.level,
                exp: 0
            }
            user.myPets[pet.enemyId] = pet;

            //Cho vao my team

            let teamMemberCount = Object.keys(user.myTeam).length;
            if (teamMemberCount >= 3) {
                res.status(200).json({
                    error: 0,
                    msg: 'Bat pet thanh cong'
                });
                return
            }

            let studentTeamSql = 'insert into student_team (enemy_id, student_id, index) values ($1, $2, $3)';
            poolWrite.query(studentTeamSql, [pet.enemyId, userId, teamMemberCount + 1]);

            if (user.myTeam == undefined) {
                user.myTeam = {};
            }
            let teamMember = {
                enemyId: pet.enemyId,
                index: teamMemberCount + 1
            }
            user.myTeam[teamMember.enemyId] = teamMember;

            res.status(200).json({
                error: 0,
                msg: 'Bat pet thanh cong'
            })
        }).catch(e => {
            console.log('[Error]:postUsersTameEnemies - studentEnemySql:', e);
            res.status(502).json({
                error: 1,
                msg: 'Service Error'
            })
            return
        });
    } catch (e) {
        console.log('[Error]:postUsersTameEnemies:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}


const changeArea = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:changeArea:');
        // Todo: Tinh new position
        // Todo code in here
        let userId = parseInt(req.headers['userid']);
        let users = [];
        let oldAreaCode = vlr.listUsers[userId].areaCode; // Lay area hien tai
        let areaCode = req.body.areaCode;
        console.log('areaCode:', areaCode);
        if (areaCode == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'Sai du lieu'
            })
        }
        let oldArea = vlr.areas[oldAreaCode];
        let newArea = vlr.areas[areaCode];
        //Todo: sửa lại px py từ string lại thành số

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
            areaCode: areaCode,
            mapCode: newArea.mapCode,
            currentTask: vlr.listUsers[userId].currentTask,
            currentAction: vlr.listUsers[userId].currentAction
        }
        let userPet;
        if (vlr.listUsers[userId].petId != undefined) {
            userPet = vlr.listUsers[userId].myPets[vlr.listUsers[userId].petId]

        }
        user.pet = userPet;

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
        let roomUsers
        if (vlr.areas[areaCode] != undefined) {
            roomUsers = vlr.areas[areaCode].listUsers;
        }
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
        if (oldAreaCode == areaCode) {
            // Do nothing
            res.status(200).json({
                error: 0,
                msg: 'Change area thanh cong',
                user: user,
                listUsers: users,
                areaEnemies: areaEnemies != undefined ? Object.keys(areaEnemies).map((key) => areaEnemies[key]) : [],
                areaGoods: areaGoods != undefined ? Object.keys(areaGoods).map((key) => areaGoods[key]) : [],
                areaEvents: areaEvents != undefined ? Object.keys(areaEvents).map((key) => areaEvents[key]) : [],
                areaNPCs: areaNPCs != undefined ? Object.keys(areaNPCs).map((key) => areaNPCs[key]) : [],
                taskEnemies: taskEnemies != undefined ? Object.keys(taskEnemies).map((key) => taskEnemies[key]) : [],
                taskGoods: taskGoods != undefined ? Object.keys(taskGoods).map((key) => taskGoods[key]) : [],
                taskEvents: taskEvents != undefined ? Object.keys(taskEvents).map((key) => taskEvents[key]) : [],
                taskNPCs: taskNPCs != undefined ? Object.keys(taskNPCs).map((key) => taskNPCs[key]) : [],
                actionEnemies: actionEnemies != undefined ? Object.keys(actionEnemies).map((key) => actionEnemies[key]) : [],
                actionGoods: actionGoods != undefined ? Object.keys(actionGoods).map((key) => actionGoods[key]) : [],
                actionEvents: actionEvents != undefined ? Object.keys(actionEvents).map((key) => actionEvents[key]) : [],
                actionNPCs: actionNPCs != undefined ? Object.keys(actionNPCs).map((key) => actionNPCs[key]) : []

            });
            return;
        } else {
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
            // Cập nhật vị trí x & y
            let checkPoint;
            let listCheckPoints = vlr.checkPoints[newArea.mapCode][newArea.code];
            // Tim kiem checkPoint
            if (listCheckPoints == undefined) {
                console.log('listCheckPoints: Loi khong lay duoc list check point');
                res.status(502).json({
                    error: 1,
                    msg: 'Service Error'
                })
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
                res.status(502).json({
                    error: 1,
                    msg: 'Service Error'
                })
                return;
            }
            if (user.checkPoint != undefined) {
                delete user.checkPoint;
            }
            user.checkPoint = {
                px: parseFloat(checkPoint.px),
                py: parseFloat(checkPoint.py)

            };
            user.px = parseFloat(checkPoint.px);
            user.py = parseFloat(checkPoint.py);
            user.areaCode = newArea.code;
            user.mapCode = newArea.mapCode;
            vlr.listUsers[userId].px = user.px;
            vlr.listUsers[userId].py = user.py;
            vlr.listUsers[userId].areaCode = newArea.code;
            vlr.listUsers[userId].mapCode = newArea.mapCode;
            // Cap nhat vi tri vao CSDL
            let sql = 'update student set area_code = $1,map_code =$2 , p_x = $3, p_y = $4, checkpoint_x = $3, checkpoint_y= $4 where id = $5';
            poolWrite.query(sql, [user.areaCode, user.mapCode, user.px, user.py, user.userId]);
            if (vlr.areas[areaCode].listUsers == undefined) {
                vlr.areas[areaCode].listUsers = {}
            }
            // Bo sung thon tin vao room
            vlr.areas[areaCode].listUsers[userId] = userId;
            // Gui thong tin cho nguoi join
            // Kiem tra xem nhiem vu co phai la nhiem vu di chuyen hay khong

            res.status(200).json({
                error: 0,
                msg: 'Change area thanh cong',
                user: user,
                listUsers: users,
                areaEnemies: areaEnemies != undefined ? Object.keys(areaEnemies).map((key) => areaEnemies[key]) : [],
                areaGoods: areaGoods != undefined ? Object.keys(areaGoods).map((key) => areaGoods[key]) : [],
                areaEvents: areaEvents != undefined ? Object.keys(areaEvents).map((key) => areaEvents[key]) : [],
                areaNPCs: areaNPCs != undefined ? Object.keys(areaNPCs).map((key) => areaNPCs[key]) : [],
                taskEnemies: taskEnemies != undefined ? Object.keys(taskEnemies).map((key) => taskEnemies[key]) : [],
                taskGoods: taskGoods != undefined ? Object.keys(taskGoods).map((key) => taskGoods[key]) : [],
                taskEvents: taskEvents != undefined ? Object.keys(taskEvents).map((key) => taskEvents[key]) : [],
                taskNPCs: taskNPCs != undefined ? Object.keys(taskNPCs).map((key) => taskNPCs[key]) : [],
                actionEnemies: actionEnemies != undefined ? Object.keys(actionEnemies).map((key) => actionEnemies[key]) : [],
                actionGoods: actionGoods != undefined ? Object.keys(actionGoods).map((key) => actionGoods[key]) : [],
                actionEvents: actionEvents != undefined ? Object.keys(actionEvents).map((key) => actionEvents[key]) : [],
                actionNPCs: actionNPCs != undefined ? Object.keys(actionNPCs).map((key) => actionNPCs[key]) : []
            });
        }
    } catch (e) {
        console.log('[Error]:changeArea:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}

const listenned = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId];
        let actionCode = req.body.actionCode;
        if (actionCode == undefined) {
            console.log("Action code null:");
            res.status(400).json({
                error: 1,
                msg: 'Du lieu actionCode null'
            })
            return;
        }
        // Xac dinh xem day co phai la action hien tai cua nguoi dung khong
        if (user.currentActionCode != actionCode) {
            // Sai ma action Code
            res.status(400).json({
                error: 1,
                msg: 'Du lieu actionCode sai'
            })
            return;
        }
        // Hoan thanh action
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

            if (user.currentAction.actionType == 18) {
                common.checkActionLevelUp(vlr, userId, poolWrite).then(dataLevel => {
                    if (dataLevel != undefined) {
                        res.status(200).json({
                            error: 0,
                            msg: 'Cap nhat thanh cong',
                            Status: dataLevel.status,
                            prize: dataLevel.prize,
                            currentTask: user.currentTask,
                            currentAction: user.currentAction,
                        })
                    } else{
                        res.status(200).json({
                            error: 0,
                            msg: 'Cap nhat thanh cong',
                            Status: data.status,
                            prize: data.prize,
                            currentTask: user.currentTask,
                            currentAction: user.currentAction,
                            taskEnemies: data.taskEnemies != undefined ? data.taskEnemies : [],
                            taskGoods: data.taskGoods != undefined ? data.taskGoods : [],
                            taskEvents: data.taskEvents != undefined ? data.taskEvents : [],
                            taskNPCs: data.taskNPCs != undefined ? data.taskNPCs : [],
                            actionEnemies: data.actionEnemies != undefined ? data.actionEnemies : [],
                            actionGoods: data.actionGoods != undefined ? data.actionGoods : [],
                            actionEvents: data.actionEvents != undefined ? data.actionEvents : [],
                            actionNPCs: data.actionNPCs != undefined ? data.actionNPCs : []
                        })
                    }
                }).catch(errorLevel => {
                    console.log("Loi trong qua trinh update:", errorLevel);
                    res.status(502).json({
                        error: 1,
                        msg: 'Service Error'
                    })
                })
            } else {
                // Send to client
                res.status(200).json({
                    error: 0,
                    msg: 'Cap nhat thanh cong',
                    Status: data.status,
                    prize: data.prize,
                    currentTask: user.currentTask,
                    currentAction: user.currentAction,
                    taskEnemies: data.taskEnemies != undefined ? data.taskEnemies : [],
                    taskGoods: data.taskGoods != undefined ? data.taskGoods : [],
                    taskEvents: data.taskEvents != undefined ? data.taskEvents : [],
                    taskNPCs: data.taskNPCs != undefined ? data.taskNPCs : [],
                    actionEnemies: data.actionEnemies != undefined ? data.actionEnemies : [],
                    actionGoods: data.actionGoods != undefined ? data.actionGoods : [],
                    actionEvents: data.actionEvents != undefined ? data.actionEvents : [],
                    actionNPCs: data.actionNPCs != undefined ? data.actionNPCs : []
                })
            }


        }).catch(error => {
            console.log("Loi trong qua trinh update:", error);
            res.status(502).json({
                error: 1,
                msg: 'Service Error'
            })
        })
    } catch (e) {
        console.log('[Error]:listenned:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}

const talked = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:talked:');
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId];
        let actionCode = req.body.actionCode;
        if (actionCode == undefined) {
            console.log("Action code null:");
            res.status(400).json({
                error: 1,
                msg: 'Du lieu actionCode null'
            })
            return;
        }
        // Xac dinh xem day co phai la action hien tai cua nguoi dung khong
        if (user.currentActionCode != actionCode) {
            // Sai ma action Code
            res.status(400).json({
                error: 1,
                msg: 'Du lieu actionCode sai'
            })
            return;
        }
        // Hoan thanh action
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

            if (user.currentAction.actionType == 18) {
                common.checkActionLevelUp(vlr, userId, poolWrite).then(dataLevel => {
                    if (dataLevel != undefined) {
                        res.status(200).json({
                            error: 0,
                            msg: 'Cap nhat thanh cong',
                            Status: dataLevel.status,
                            prize: dataLevel.prize,
                            currentTask: user.currentTask,
                            currentAction: user.currentAction,
                        })
                        return
                    }
                }).catch(errorLevel => {
                    console.log("Loi trong qua trinh update:", errorLevel);
                    res.status(502).json({
                        error: 1,
                        msg: 'Service Error'
                    })
                })
                return
            }

            // Send to client
            res.status(200).json({
                error: 0,
                msg: 'Cap nhat thanh cong',
                Status: data.status,
                prize: data.prize,
                currentTask: user.currentTask,
                currentAction: user.currentAction,
                taskEnemies: data.taskEnemies != undefined ? data.taskEnemies : [],
                taskGoods: data.taskGoods != undefined ? data.taskGoods : [],
                taskEvents: data.taskEvents != undefined ? data.taskEvents : [],
                taskNPCs: data.taskNPCs != undefined ? data.taskNPCs : [],
                actionEnemies: data.actionEnemies != undefined ? data.actionEnemies : [],
                actionGoods: data.actionGoods != undefined ? data.actionGoods : [],
                actionEvents: data.actionEvents != undefined ? data.actionEvents : [],
                actionNPCs: data.actionNPCs != undefined ? data.actionNPCs : []
            })
        }).catch(error => {
            console.log("Loi trong qua trinh update:", error);
            res.status(502).json({
                error: 1,
                msg: 'Service Error'
            })
        })
    } catch (e) {
        console.log('[Error]:listenned:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}

const gotEnemy = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:gotEnemy:');
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId];
        let actionCode = req.body.actionCode;
        let enemyCode = req.body.enemyCode;
        //Check actionCode va enemyCode invalid
        if (actionCode == undefined || enemyCode == undefined) {
            console.log("Action code hoac enemy Code null:");
            res.status(400).json({
                error: 1,
                msg: 'Du lieu actionCode hoac enemyCode null'
            })
            return;
        }
        // Xac dinh xem day co phai la action hien tai cua nguoi dung khong
        if (user.currentActionCode != actionCode) {
            // Sai ma action Code
            res.status(400).json({
                error: 1,
                msg: 'Du lieu actionCode sai'
            })
            return;
        }
        // Xem co phai action nhan thu khong
        if (user.currentAction.actionType != 23 || user.currentAction.actionType != 9) {
            if (vlr.enemiesSpecial[enemyCode] == undefined) {
                res.status(400).json({
                    error: 1,
                    msg: 'Action nay khong phai action nhan pet'
                })
                return;
            }
        }
        // Xem con thu do co ton tai khong (trong enemies_special va enemies)
        if (user.currentAction.actionType == 23) {
            if (vlr.enemiesSpecial[enemyCode] == undefined) {
                res.status(400).json({
                    error: 1,
                    msg: 'Du lieu enemyCode sai'
                })
                return;
            }
            let studentEnemySpecialSql = 'insert into student_enemy_special (enemy_code, task_code, action_code, student_id) values ($1, $2, $3, $4) returning task_code, action_code, id'
            poolWrite.query(studentEnemySpecialSql, [enemyCode, user.currentTaskCode, user.currentActionCode, userId]).then(data => {
                if (data.rowCount < 1) {
                    res.status(502).json({
                        error: 1,
                        msg: 'Service Error'
                    })
                    return
                }

                let petRecord = data.rows[0];

                if (user.enemiesSpecial == undefined) {
                    user.enemiesSpecial = {}
                }
                let pet = {
                    enemyId: petRecord.id,
                    enemyCode: enemyCode,
                    taskCode: user.currentTaskCode,
                    actionCode: user.currentActionCode
                }
                user.enemiesSpecial[pet.enemyCode] = pet;
            }).then(() => {
                // Hoan thanh action
                common.updateActionStatus(vlr, userId, poolWrite).then(data => {
                    // Cap nhat lai du lieu cho user
                    user.currentActionCode = data.nextActionCode;
                    user.currentTaskCode = data.nextTaskCode;
                    user.currentAction = vlr.actions.full[data.nextActionCode];
                    user.currentTask = vlr.tasks[data.nextTaskCode];
                    // Cap nhat db
                    let sql = 'update student set current_task_code = $1, current_action_code = $2 where id = $3';
                    poolWrite.query(sql, [user.currentTaskCode, user.currentActionCode, userId]);

                    if (user.currentAction.actionType == 18) {
                        common.checkActionLevelUp(vlr, userId, poolWrite).then(dataLevel => {
                            if (dataLevel != undefined) {
                                res.status(200).json({
                                    error: 0,
                                    msg: 'Cap nhat thanh cong',
                                    Status: dataLevel.status,
                                    prize: dataLevel.prize,
                                    currentTask: user.currentTask,
                                    currentAction: user.currentAction,
                                })
                                return
                            }
                        }).catch(errorLevel => {
                            console.log("Loi trong qua trinh update:", errorLevel);
                            res.status(502).json({
                                error: 1,
                                msg: 'Service Error'
                            })
                        })
                        return
                    }

                    // Send to client
                    res.status(200).json({
                        error: 0,
                        msg: 'Cap nhat thanh cong',
                        Status: data.status,
                        prize: data.prize,
                        currentTask: user.currentTask,
                        currentAction: user.currentAction,
                        taskEnemies: data.taskEnemies != undefined ? data.taskEnemies : [],
                        taskGoods: data.taskGoods != undefined ? data.taskGoods : [],
                        taskEvents: data.taskEvents != undefined ? data.taskEvents : [],
                        taskNPCs: data.taskNPCs != undefined ? data.taskNPCs : [],
                        actionEnemies: data.actionEnemies != undefined ? data.actionEnemies : [],
                        actionGoods: data.actionGoods != undefined ? data.actionGoods : [],
                        actionEvents: data.actionEvents != undefined ? data.actionEvents : [],
                        actionNPCs: data.actionNPCs != undefined ? data.actionNPCs : []
                    })
                }).catch(error => {
                    console.log("Loi trong qua trinh update:", error);
                    res.status(502).json({
                        error: 1,
                        msg: 'Service Error'
                    })
                })
            })
                .catch(e => {
                    console.log('[Error]:postgot enemy - studentEnemySql:', e);
                    res.status(502).json({
                        error: 1,
                        msg: 'Service Error'
                    })
                    return
                });
        }
        if (user.currentAction.actionType == 9) {
            if (vlr.enemies[enemyCode] == undefined) {
                res.status(400).json({
                    error: 1,
                    msg: 'Du lieu enemyCode sai'
                })
                return;
            }
            let studentEnemySql = 'insert into student_enemy (evolution_level, enemy_code, level, student_id) values ($1, $2, $3, $4) returning id, evolution_level, level'
            poolWrite.query(studentEnemySql, [vlr.areaEnemies.full[enemyId].evolutionLevel, enemyCode, 1, userId]).then(data => {
                if (data.rowCount < 1) {
                    res.status(502).json({
                        error: 1,
                        msg: 'Service Error'
                    })
                    return
                }

                let petRecord = data.rows[0];
                if (user.myPets == undefined) {
                    user.myPets = {}
                }
                let pet = {
                    enemyId: petRecord.id,
                    evolutionLevel: petRecord.evolution_level,
                    level: petRecord.level,
                    exp: 0
                }
                user.myPets[pet.enemyId] = pet;

                //Cho vao my team

                let teamMemberCount = Object.keys(user.myTeam).length;
                if (teamMemberCount >= 3) {
                    res.status(200).json({
                        error: 0,
                        msg: 'Bat pet thanh cong'
                    });
                    return
                }

                let studentTeamSql = 'insert into student_team (enemy_id, student_id, index) values ($1, $2, $3)';
                poolWrite.query(studentTeamSql, [pet.enemyId, userId, teamMemberCount + 1]);

                if (user.myTeam == undefined) {
                    user.myTeam = {};
                }
                let teamMember = {
                    enemyId: pet.enemyId,
                    index: teamMemberCount + 1
                }
                user.myTeam[teamMember.enemyId] = teamMember;
            }).then(() => {
                // Hoan thanh action
                common.updateActionStatus(vlr, userId, poolWrite).then(data => {
                    // Cap nhat lai du lieu cho user
                    user.currentActionCode = data.nextActionCode;
                    user.currentTaskCode = data.nextTaskCode;
                    user.currentAction = vlr.actions.full[data.nextActionCode];
                    user.currentTask = vlr.tasks[data.nextTaskCode];
                    // Cap nhat db
                    let sql = 'update student set current_task_code = $1, current_action_code = $2 where id = $3';
                    poolWrite.query(sql, [user.currentTaskCode, user.currentActionCode, userId]);

                    if (user.currentAction.actionType == 18) {
                        common.checkActionLevelUp(vlr, userId, poolWrite).then(dataLevel => {
                            if (dataLevel != undefined) {
                                res.status(200).json({
                                    error: 0,
                                    msg: 'Cap nhat thanh cong',
                                    Status: dataLevel.status,
                                    prize: dataLevel.prize,
                                    currentTask: user.currentTask,
                                    currentAction: user.currentAction,
                                })
                                return
                            }
                        }).catch(errorLevel => {
                            console.log("Loi trong qua trinh update:", errorLevel);
                            res.status(502).json({
                                error: 1,
                                msg: 'Service Error'
                            })
                        })
                        return
                    }

                    // Send to client
                    res.status(200).json({
                        error: 0,
                        msg: 'Cap nhat thanh cong',
                        Status: data.status,
                        prize: data.prize,
                        currentTask: user.currentTask,
                        currentAction: user.currentAction,
                        taskEnemies: data.taskEnemies != undefined ? data.taskEnemies : [],
                        taskGoods: data.taskGoods != undefined ? data.taskGoods : [],
                        taskEvents: data.taskEvents != undefined ? data.taskEvents : [],
                        taskNPCs: data.taskNPCs != undefined ? data.taskNPCs : [],
                        actionEnemies: data.actionEnemies != undefined ? data.actionEnemies : [],
                        actionGoods: data.actionGoods != undefined ? data.actionGoods : [],
                        actionEvents: data.actionEvents != undefined ? data.actionEvents : [],
                        actionNPCs: data.actionNPCs != undefined ? data.actionNPCs : []
                    })
                }).catch(error => {
                    console.log("Loi trong qua trinh update:", error);
                    res.status(502).json({
                        error: 1,
                        msg: 'Service Error'
                    })
                })
            })
                .catch(e => {
                    console.log('[Error]:actionEnemy - studentEnemySql:', e);
                    res.status(502).json({
                        error: 1,
                        msg: 'Service Error'
                    })
                    return
                });
        }
    } catch (e) {
        console.log('[Error]:gotEnemy:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}

const returnedEnemy = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:returnedEnemy:');
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId];
        //Check actionCode va enemyCode invalid
        if (user.currentActionCode == undefined) {
            console.log("Action code undefined");
            res.status(400).json({
                error: 1,
                msg: 'Du lieu actionCode hoac enemyCode null'
            })
            return;
        }
        // Xem co phai action tra do
        if (user.currentAction.actionType != 5) {
            res.status(400).json({
                error: 1,
                msg: 'Action nay khong phai action tra enemy special'
            })
            return;
        }
        // Xem co do do khong va co du khong
        let relation = user.currentAction.relation[Object.keys(user.currentAction.relation)[0]];
        let goodsCode = relation.relationCode;
        let goodsCount = relation.relationCount;
        if (user.mySpecialEnemies[goodsCode] == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'Ban khong so huu thu nay'
            })
            return;
        }
        if (user.mySpecialEnemies[goodsCode].count < goodsCount) {
            res.status(400).json({
                error: 1,
                msg: 'Khong du so luong'
            })
            return;
        }

        let studentGoodsSql;
        if (user.mySpecialEnemies[goodsCode].count == goodsCount) {
            studentGoodsSql = 'delete from student_goods where student_id = $1 and goods_code = $2';
            poolWrite.query(studentGoodsSql, [userId, goodsCode]);
            delete user.mySpecialEnemies[goodsCode];
        } else if (user.mySpecialEnemies[goodsCode].count > goodsCount) {
            studentGoodsSql = 'update student_goods set count = student_goods.count - $1 where student_id = $2 and goods_code = $3';
            poolWrite.query(studentGoodsSql, [goodsCount, userId, goodsCode])
            user.mySpecialEnemies[goodsCode].count = user.mySpecialEnemies[goodsCode].count - goodsCount;
        }
        // Hoan thanh action
        common.updateActionStatus(vlr, userId, poolWrite).then(data => {
            // Cap nhat lai du lieu cho user
            user.currentActionCode = data.nextActionCode;
            user.currentTaskCode = data.nextTaskCode;
            user.currentAction = vlr.actions.full[data.nextActionCode];
            user.currentTask = vlr.tasks[data.nextTaskCode];
            // Cap nhat db
            let sql = 'update student set current_task_code = $1, current_action_code = $2 where id = $3';
            poolWrite.query(sql, [user.currentTaskCode, user.currentActionCode, userId]);

            if (user.currentAction.actionType == 18) {
                common.checkActionLevelUp(vlr, userId, poolWrite).then(dataLevel => {
                    if (dataLevel != undefined) {
                        res.status(200).json({
                            error: 0,
                            msg: 'Cap nhat thanh cong',
                            Status: dataLevel.status,
                            prize: dataLevel.prize,
                            currentTask: user.currentTask,
                            currentAction: user.currentAction,
                        })
                        return
                    }
                }).catch(errorLevel => {
                    console.log("Loi trong qua trinh update:", errorLevel);
                    res.status(502).json({
                        error: 1,
                        msg: 'Service Error'
                    })
                })
                return
            }

            // Send to client
            res.status(200).json({
                error: 0,
                msg: 'Cap nhat thanh cong',
                Status: data.status,
                prize: data.prize,
                currentTask: user.currentTask,
                currentAction: user.currentAction,
                taskEnemies: data.taskEnemies != undefined ? data.taskEnemies : [],
                taskGoods: data.taskGoods != undefined ? data.taskGoods : [],
                taskEvents: data.taskEvents != undefined ? data.taskEvents : [],
                taskNPCs: data.taskNPCs != undefined ? data.taskNPCs : [],
                actionEnemies: data.actionEnemies != undefined ? data.actionEnemies : [],
                actionGoods: data.actionGoods != undefined ? data.actionGoods : [],
                actionEvents: data.actionEvents != undefined ? data.actionEvents : [],
                actionNPCs: data.actionNPCs != undefined ? data.actionNPCs : []
            })
        }).catch(error => {
            console.log("Loi trong qua trinh update:", error);
            res.status(502).json({
                error: 1,
                msg: 'Service Error'

            })
        })




    } catch (e) {
        console.log('[Error]:returnedEnemy:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}

const returnedGoods = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:returnedGoods:');
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId];
        //Check actionCode va enemyCode invalid
        if (user.currentActionCode == undefined) {
            console.log("Action code undefined");
            res.status(400).json({
                error: 1,
                msg: 'Du lieu actionCode hoac enemyCode null'
            })
            return;
        }
        // Xem co phai action tra do
        if (user.currentAction.actionType != 8) {
            res.status(400).json({
                error: 1,
                msg: 'Action nay khong phai action tra do'
            })
            return;
        }
        // Xem co do do khong va co du khong
        let relation = user.currentAction.relation[Object.keys(user.currentAction.relation)[0]];
        let goodsCode = relation.relationCode;
        let goodsCount = relation.relationCount;
        if (user.myGoods[goodsCode] == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'Ban khong so huu do nay'
            })
            return;
        }
        if (user.myGoods[goodsCode].count < goodsCount) {
            res.status(400).json({
                error: 1,
                msg: 'Khong du so luong'
            })
            return;
        }

        let studentGoodsSql;
        if (user.myGoods[goodsCode].count == goodsCount) {
            studentGoodsSql = 'delete from student_goods where student_id = $1 and goods_code = $2';
            poolWrite.query(studentGoodsSql, [userId, goodsCode]);
            delete user.myGoods[goodsCode];
        } else if (user.myGoods[goodsCode].count > goodsCount) {
            studentGoodsSql = 'update student_goods set count = student_goods.count - $1 where student_id = $2 and goods_code = $3';
            poolWrite.query(studentGoodsSql, [goodsCount, userId, goodsCode])
            user.myGoods[goodsCode].count = user.myGoods[goodsCode].count - goodsCount;
        }
        // Hoan thanh action
        common.updateActionStatus(vlr, userId, poolWrite).then(data => {
            // Cap nhat lai du lieu cho user
            user.currentActionCode = data.nextActionCode;
            user.currentTaskCode = data.nextTaskCode;
            user.currentAction = vlr.actions.full[data.nextActionCode];
            user.currentTask = vlr.tasks[data.nextTaskCode];
            // Cap nhat db
            let sql = 'update student set current_task_code = $1, current_action_code = $2 where id = $3';
            poolWrite.query(sql, [user.currentTaskCode, user.currentActionCode, userId]);

            if (user.currentAction.actionType == 18) {
                common.checkActionLevelUp(vlr, userId, poolWrite).then(dataLevel => {
                    if (dataLevel != undefined) {
                        res.status(200).json({
                            error: 0,
                            msg: 'Cap nhat thanh cong',
                            Status: dataLevel.status,
                            prize: dataLevel.prize,
                            currentTask: user.currentTask,
                            currentAction: user.currentAction,
                        })
                        return
                    }
                }).catch(errorLevel => {
                    console.log("Loi trong qua trinh update:", errorLevel);
                    res.status(502).json({
                        error: 1,
                        msg: 'Service Error'
                    })
                })
                return
            }

            // Send to client
            res.status(200).json({
                error: 0,
                msg: 'Cap nhat thanh cong',
                Status: data.status,
                prize: data.prize,
                currentTask: user.currentTask,
                currentAction: user.currentAction,
                taskEnemies: data.taskEnemies != undefined ? data.taskEnemies : [],
                taskGoods: data.taskGoods != undefined ? data.taskGoods : [],
                taskEvents: data.taskEvents != undefined ? data.taskEvents : [],
                taskNPCs: data.taskNPCs != undefined ? data.taskNPCs : [],
                actionEnemies: data.actionEnemies != undefined ? data.actionEnemies : [],
                actionGoods: data.actionGoods != undefined ? data.actionGoods : [],
                actionEvents: data.actionEvents != undefined ? data.actionEvents : [],
                actionNPCs: data.actionNPCs != undefined ? data.actionNPCs : []
            })
        }).catch(error => {
            console.log("Loi trong qua trinh update:", error);
            res.status(502).json({
                error: 1,
                msg: 'Service Error'

            })
        })




    } catch (e) {
        console.log('[Error]:returnedGoods:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}

const putOutFire = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:putOutFire:');
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId];
        let actionCode = req.body.actionCode;
        if (actionCode == undefined) {
            console.log("Action code null:");
            res.status(400).json({
                error: 1,
                msg: 'Du lieu actionCode null'
            })
            return;
        }
        // Xac dinh xem day co phai la action hien tai cua nguoi dung khong
        if (user.currentActionCode != actionCode || user.currentAction.actionType != 13) {
            // Sai ma action Code
            res.status(400).json({
                error: 1,
                msg: 'Du lieu actionCode sai hoac khong phai action dap lua'
            })
            return;
        }
        //Kiem tra xem co rua khong
        let haveTurtle = false;
        for (i in user.myPets) {
            if (user.myPets[i].enemyCode == "baby_turtle" && user.myPets[i].level >= 5) {
                haveTurtle = true;
            }
        }
        if (haveTurtle == false) {
            res.status(200).json({
                error: 1,
                msg: 'Khong co rua lon hon cap 5 de dap lua'
            })
            return;
        }
        // Hoan thanh action
        common.updateActionStatus(vlr, userId, poolWrite).then(data => {
            // Cap nhat lai du lieu cho user
            user.currentActionCode = data.nextActionCode;
            user.currentTaskCode = data.nextTaskCode;
            user.currentAction = vlr.actions.full[data.nextActionCode];
            user.currentTask = vlr.tasks[data.nextTaskCode];
            // Cap nhat db
            let sql = 'update student set current_task_code = $1, current_action_code = $2 where id = $3';
            poolWrite.query(sql, [user.currentTaskCode, user.currentActionCode, userId]);

            if (user.currentAction.actionType == 18) {
                common.checkActionLevelUp(vlr, userId, poolWrite).then(dataLevel => {
                    if (dataLevel != undefined) {
                        res.status(200).json({
                            error: 0,
                            msg: 'Cap nhat thanh cong',
                            Status: dataLevel.status,
                            prize: dataLevel.prize,
                            currentTask: user.currentTask,
                            currentAction: user.currentAction,
                        })
                        return
                    }
                }).catch(errorLevel => {
                    console.log("Loi trong qua trinh update:", errorLevel);
                    res.status(502).json({
                        error: 1,
                        msg: 'Service Error'
                    })
                })
                return
            }

            // Send to client
            res.status(200).json({
                error: 0,
                msg: 'Cap nhat thanh cong',
                Status: data.status,
                prize: data.prize,
                currentTask: user.currentTask,
                currentAction: user.currentAction,
                taskEnemies: data.taskEnemies != undefined ? data.taskEnemies : [],
                taskGoods: data.taskGoods != undefined ? data.taskGoods : [],
                taskEvents: data.taskEvents != undefined ? data.taskEvents : [],
                taskNPCs: data.taskNPCs != undefined ? data.taskNPCs : [],
                actionEnemies: data.actionEnemies != undefined ? data.actionEnemies : [],
                actionGoods: data.actionGoods != undefined ? data.actionGoods : [],
                actionEvents: data.actionEvents != undefined ? data.actionEvents : [],
                actionNPCs: data.actionNPCs != undefined ? data.actionNPCs : []
            })
        }).catch(error => {
            console.log("Loi trong qua trinh update:", error);
            res.status(502).json({
                error: 1,
                msg: 'Service Error'
            })
        })
    } catch (e) {
        console.log('[Error]:putOutFire:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}

const returnedForest = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:returnedForest:');
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId];
        let actionCode = req.body.actionCode;
        if (actionCode == undefined) {
            console.log("Action code null:");
            res.status(400).json({
                error: 1,
                msg: 'Du lieu actionCode null'
            })
            return;
        }
        // Xac dinh xem day co phai la action hien tai cua nguoi dung khong
        if (user.currentActionCode != actionCode || user.currentAction.actionType != 14) {
            // Sai ma action Code
            res.status(400).json({
                error: 1,
                msg: 'Du lieu actionCode sai hoac khong phai action dap lua'
            })
            return;
        }
        if (user.mySpecialEnemies['T022_deer'] == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'Ban ko co con huou'
            })
            return;
        }
        // Hoan thanh action
        common.updateActionStatus(vlr, userId, poolWrite).then(data => {
            // Cap nhat lai du lieu cho user
            user.currentActionCode = data.nextActionCode;
            user.currentTaskCode = data.nextTaskCode;
            user.currentAction = vlr.actions.full[data.nextActionCode];
            user.currentTask = vlr.tasks[data.nextTaskCode];
            // Cap nhat db
            let sql = 'update student set current_task_code = $1, current_action_code = $2 where id = $3';
            poolWrite.query(sql, [user.currentTaskCode, user.currentActionCode, userId]);

            if (user.currentAction.actionType == 18) {
                common.checkActionLevelUp(vlr, userId, poolWrite).then(dataLevel => {
                    res.status(200).json({
                        error: 0,
                        msg: 'Cap nhat thanh cong',
                        Status: dataLevel.status,
                        prize: dataLevel.prize,
                        currentTask: user.currentTask,
                        currentAction: user.currentAction,
                    })
                    return
                }).catch(errorLevel => {
                    console.log("Loi trong qua trinh update:", errorLevel);
                    res.status(502).json({
                        error: 1,
                        msg: 'Service Error'
                    })
                })
                return
            }

            // Send to client
            res.status(200).json({
                error: 0,
                msg: 'Cap nhat thanh cong',
                Status: data.status,
                prize: data.prize,
                currentTask: user.currentTask,
                currentAction: user.currentAction,
                taskEnemies: data.taskEnemies != undefined ? data.taskEnemies : [],
                taskGoods: data.taskGoods != undefined ? data.taskGoods : [],
                taskEvents: data.taskEvents != undefined ? data.taskEvents : [],
                taskNPCs: data.taskNPCs != undefined ? data.taskNPCs : [],
                actionEnemies: data.actionEnemies != undefined ? data.actionEnemies : [],
                actionGoods: data.actionGoods != undefined ? data.actionGoods : [],
                actionEvents: data.actionEvents != undefined ? data.actionEvents : [],
                actionNPCs: data.actionNPCs != undefined ? data.actionNPCs : []
            })
        }).catch(error => {
            console.log("Loi trong qua trinh update:", error);
            res.status(502).json({
                error: 1,
                msg: 'Service Error'
            })
        })
    } catch (e) {
        console.log('[Error]:returnedForest:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}

const meet = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:meet:');
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId];
        let actionCode = req.body.actionCode;
        if (actionCode == undefined) {
            console.log("Action code null:");
            res.status(400).json({
                error: 1,
                msg: 'Du lieu actionCode null'
            })
            return;
        }
        // Xac dinh xem day co phai la action hien tai cua nguoi dung khong
        if (user.currentActionCode != actionCode || user.currentAction.actionType != 24) {
            // Sai ma action Code
            res.status(400).json({
                error: 1,
                msg: 'Du lieu actionCode sai hoac khong phai action meet'
            })
            return;
        }
        // Hoan thanh action
        common.updateActionStatus(vlr, userId, poolWrite).then(data => {
            // Cap nhat lai du lieu cho user
            user.currentActionCode = data.nextActionCode;
            user.currentTaskCode = data.nextTaskCode;
            user.currentAction = vlr.actions.full[data.nextActionCode];
            user.currentTask = vlr.tasks[data.nextTaskCode];
            // Cap nhat db
            let sql = 'update student set current_task_code = $1, current_action_code = $2 where id = $3';
            poolWrite.query(sql, [user.currentTaskCode, user.currentActionCode, userId]);

            if (user.currentAction.actionType == 18) {
                common.checkActionLevelUp(vlr, userId, poolWrite).then(dataLevel => {
                    res.status(200).json({
                        error: 0,
                        msg: 'Cap nhat thanh cong',
                        Status: dataLevel.status,
                        prize: dataLevel.prize,
                        currentTask: user.currentTask,
                        currentAction: user.currentAction,
                    })
                    return
                }).catch(errorLevel => {
                    console.log("Loi trong qua trinh update:", errorLevel);
                    res.status(502).json({
                        error: 1,
                        msg: 'Service Error'
                    })
                })
                return
            }

            // Send to client
            res.status(200).json({
                error: 0,
                msg: 'Cap nhat thanh cong',
                Status: data.status,
                prize: data.prize,
                currentTask: user.currentTask,
                currentAction: user.currentAction,
                taskEnemies: data.taskEnemies != undefined ? data.taskEnemies : [],
                taskGoods: data.taskGoods != undefined ? data.taskGoods : [],
                taskEvents: data.taskEvents != undefined ? data.taskEvents : [],
                taskNPCs: data.taskNPCs != undefined ? data.taskNPCs : [],
                actionEnemies: data.actionEnemies != undefined ? data.actionEnemies : [],
                actionGoods: data.actionGoods != undefined ? data.actionGoods : [],
                actionEvents: data.actionEvents != undefined ? data.actionEvents : [],
                actionNPCs: data.actionNPCs != undefined ? data.actionNPCs : []
            })
        }).catch(error => {
            console.log("Loi trong qua trinh update:", error);
            res.status(502).json({
                error: 1,
                msg: 'Service Error'
            })
        })
    } catch (e) {
        console.log('[Error]:meet:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}

const tellStory = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:tellStory:');
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId];
        let actionCode = req.body.actionCode;
        if (actionCode == undefined) {
            console.log("Action code null:");
            res.status(400).json({
                error: 1,
                msg: 'Du lieu actionCode null'
            })
            return;
        }
        // Xac dinh xem day co phai la action hien tai cua nguoi dung khong
        if (user.currentActionCode != actionCode || user.currentAction.actionType != 25) {
            // Sai ma action Code
            res.status(400).json({
                error: 1,
                msg: 'Du lieu actionCode sai hoac khong phai action tellStory'
            })
            return;
        }
        // Hoan thanh action
        common.updateActionStatus(vlr, userId, poolWrite).then(data => {
            // Cap nhat lai du lieu cho user
            user.currentActionCode = data.nextActionCode;
            user.currentTaskCode = data.nextTaskCode;
            user.currentAction = vlr.actions.full[data.nextActionCode];
            user.currentTask = vlr.tasks[data.nextTaskCode];
            // Cap nhat db
            let sql = 'update student set current_task_code = $1, current_action_code = $2 where id = $3';
            poolWrite.query(sql, [user.currentTaskCode, user.currentActionCode, userId]);

            if (user.currentAction.actionType == 18) {
                common.checkActionLevelUp(vlr, userId, poolWrite).then(dataLevel => {
                    res.status(200).json({
                        error: 0,
                        msg: 'Cap nhat thanh cong',
                        Status: dataLevel.status,
                        prize: dataLevel.prize,
                        currentTask: user.currentTask,
                        currentAction: user.currentAction,
                    })
                    return
                }).catch(errorLevel => {
                    console.log("Loi trong qua trinh update:", errorLevel);
                    res.status(502).json({
                        error: 1,
                        msg: 'Service Error'
                    })
                })
                return
            }

            // Send to client
            res.status(200).json({
                error: 0,
                msg: 'Cap nhat thanh cong',
                Status: data.status,
                prize: data.prize,
                currentTask: user.currentTask,
                currentAction: user.currentAction,
                taskEnemies: data.taskEnemies != undefined ? data.taskEnemies : [],
                taskGoods: data.taskGoods != undefined ? data.taskGoods : [],
                taskEvents: data.taskEvents != undefined ? data.taskEvents : [],
                taskNPCs: data.taskNPCs != undefined ? data.taskNPCs : [],
                actionEnemies: data.actionEnemies != undefined ? data.actionEnemies : [],
                actionGoods: data.actionGoods != undefined ? data.actionGoods : [],
                actionEvents: data.actionEvents != undefined ? data.actionEvents : [],
                actionNPCs: data.actionNPCs != undefined ? data.actionNPCs : []
            })
        }).catch(error => {
            console.log("Loi trong qua trinh update:", error);
            res.status(502).json({
                error: 1,
                msg: 'Service Error'
            })
        })
    } catch (e) {
        console.log('[Error]:tellStory:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}




const createEnemyBattle = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('createEnemyBattle');
        // Todo kiem tra ve EnemyId co ton tai hay khong ? Co cung area voi nguoi choi hay khong ? Neu khong cung Area thi khong the choi duoc.
        // Kiem tra nguoi choi co dang tham gia tran chien nao khong ? Tran chien giua nguoi voi nguoi, nguoi voi quai, nguoi voi boss. Neu co thi khong the tham gia duoc.
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId];
        let areaCode = user.areaCode;
        let enemyId = req.body.enemyId;
        let enemy = vlr.areaEnemies.full[enemyId];
        if (enemy == undefined || enemy.areaCode != user.areaCode) {
            res.status(400).json({
                error: 1,
                msg: 'Thong tin enemyId khong chinh xac'
            })
            return;
        }
        if (user.enemyBattleId != undefined || user.humanBattelId != undefined || user.bossBattelId != undefined) {
            // Dang ban danh nhau roi
            res.status(400).json({
                error: 1,
                msg: 'Dang ban danh nhau roi'
            })

            return;
        }
        // Tao thong tin cuoc chien
        let enemyBattle = {
            battleId: userId + '_' + enemyId,
            userId: userId,
            enemyId: enemyId,
            refreshTime: Date.now()
        }
        vlr.listEnemyBattles[enemyBattle.battleId] = enemyBattle;
        vlr.listUsers[enemyBattle.userId].enemyBattleId = enemyBattle.battleId;
        // Remove from room
        let i;
        let roomUsers = (vlr.areas != undefined) && (vlr.areas[areaCode] != undefined) ? vlr.areas[areaCode].listUsers : undefined;
        if (roomUsers == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'Du lieu dau vao loi'
            })
            return;
        }
        for (i in roomUsers) {
            if (i == enemyBattle.userId) {
                // Da ton tai thong tin o day thi khong lam gi
            } else {
                // Gui thong bao di chuyen
                io.to(vlr.listUsers[i].socketid).emit('u_user_remove', { userId: enemyBattle.userId });
            }

        }
        // Lay thong tin cua nguoi

        let attackerUser = {
            userId: vlr.listUsers[enemyBattle.userId].userId,
            hatCode: vlr.listUsers[enemyBattle.userId].hatCode,
            wandCode: vlr.listUsers[enemyBattle.userId].wandCode,
            outfitsCode: vlr.listUsers[enemyBattle.userId].outfitsCode,
            bootCode: vlr.listUsers[enemyBattle.userId].bootCode,
            ringCode: vlr.listUsers[enemyBattle.userId].ringCode,
            createdAt: vlr.listUsers[enemyBattle.userId].createdAt,
            px: vlr.listUsers[enemyBattle.userId].px,
            py: vlr.listUsers[enemyBattle.userId].py,
            name: vlr.listUsers[enemyBattle.userId].name,
            grade: vlr.listUsers[enemyBattle.userId].grade,
            gender: vlr.listUsers[enemyBattle.userId].gender,
            language: vlr.listUsers[enemyBattle.userId].language,
            hairStyle: vlr.listUsers[enemyBattle.userId].hairStyle,
            hairColor: vlr.listUsers[enemyBattle.userId].hairColor,
            skinColor: vlr.listUsers[enemyBattle.userId].skinColor,
            lastLogin: vlr.listUsers[enemyBattle.userId].lastLogin,
            exp: vlr.listUsers[enemyBattle.userId].exp,
            level: vlr.listUsers[enemyBattle.userId].level,
            mana: vlr.listUsers[enemyBattle.userId].mana,
            petId: vlr.listUsers[enemyBattle.userId].petId
        }
        let attackerItems = []; // Lay danh sach item
        for (i in vlr.listUsers[attackerUser.userId].myGoods) {
            let y = vlr.listUsers[attackerUser.userId].myGoods[i];
            if (y.use == 1) {
                attackerItems.push(y)
            }

        }
        attackerUser.items = attackerItems;
        // lay them item use
        // Lay thong tin team
        let attackerTotalHealth = 0;
        let attackerTeam = {};
        // Cac thong tin can thiet
        attackerTeam.userId = userId;
        attackerTeam.mana = attackerUser.mana == undefined ? 0 : attackerUser.mana;
        //attackerTeam.currentHealth = currentHealth;
        //attackerTeam.totalHealth = totalHealth;
        attackerTeam.noiThuong = [];
        attackerTeam.phongThu = [];
        attackerTeam.attackerId = attackerUser.petId;
        attackerTeam.lostTurn = 0;
        //attackerTeam.listMembers = listMembers;
        // Tinh toan health va member
        let listAttackerMembers = {};
        let teamNumber = 0;
        for (i in vlr.listUsers[attackerUser.userId].myTeam) {
            let y = vlr.listUsers[attackerUser.userId].myTeam[i];
            let member = {
                enemyId: y.enemyId,
                index: y.index,
                totalHealth: vlr.enemies[vlr.listUsers[attackerUser.userId].myPets[y.enemyId].enemyCode].baseHealth * vlr.listUsers[attackerUser.userId].myPets[y.enemyId].level,
                currentHealth: vlr.enemies[vlr.listUsers[attackerUser.userId].myPets[y.enemyId].enemyCode].baseHealth * vlr.listUsers[attackerUser.userId].myPets[y.enemyId].level,
                noiThuong: [], // Neu co thi giam 1
                phongThu: [], // Neu co thi giam 1
                dam: vlr.enemies[vlr.listUsers[attackerUser.userId].myPets[y.enemyId].enemyCode].baseDame * vlr.listUsers[attackerUser.userId].myPets[y.enemyId].level,
                enemyCode: vlr.listUsers[attackerUser.userId].myPets[y.enemyId].enemyCode,
                exp: vlr.listUsers[attackerUser.userId].myPets[y.enemyId].exp,
                elementCode: vlr.enemies[vlr.listUsers[attackerUser.userId].myPets[y.enemyId].enemyCode].elementCode,
                evolutionLevel: vlr.listUsers[attackerUser.userId].myPets[y.enemyId].evolutionLevel,
                level: vlr.listUsers[attackerUser.userId].myPets[y.enemyId].level,
                nameEn: vlr.enemies[vlr.listUsers[attackerUser.userId].myPets[y.enemyId].enemyCode].nameEn,
                nameVn: vlr.enemies[vlr.listUsers[attackerUser.userId].myPets[y.enemyId].enemyCode].nameVn,
                infoVn: vlr.enemies[vlr.listUsers[attackerUser.userId].myPets[y.enemyId].enemyCode].infoVn,
                infoEn: vlr.enemies[vlr.listUsers[attackerUser.userId].myPets[y.enemyId].enemyCode].infoEn,
                infoEnVoice: vlr.enemies[vlr.listUsers[attackerUser.userId].myPets[y.enemyId].enemyCode].infoEnVoice,
                infoVnVoice: vlr.enemies[vlr.listUsers[attackerUser.userId].myPets[y.enemyId].enemyCode].infoVnVoice,
                status: 1,
                wasInBattle: 0,
                listSkill: common.getListSkill(vlr, vlr.enemies[vlr.listUsers[attackerUser.userId].myPets[y.enemyId].enemyCode].elementCode, vlr.listUsers[attackerUser.userId].myPets[y.enemyId].evolutionLevel, vlr.listUsers[attackerUser.userId].myPets[y.enemyId].level, attackerTeam.mana)
            }
            listAttackerMembers[member.enemyId] = member;
            attackerTotalHealth = attackerTotalHealth + member.totalHealth;
            teamNumber = teamNumber + 1;
        }
        attackerTeam.listMembers = listAttackerMembers;
        attackerTeam.totalHealth = attackerTotalHealth;
        attackerTeam.currentHealth = attackerTotalHealth;
        enemyBattle.humanTeam = attackerTeam;
        // Thiet lap team cho enemy
        let enemyTeamNumber = 1;
        if (teamNumber < 2) {

        } else {
            // Lay so luong teamNumber
            enemyTeamNumber = common.getRndInteger(1, teamNumber);
        }
        // Khoi tao cho team enemy
        let attackedTotalHealth = 0;
        let attackedTeam = {};
        // Cac thong tin can thiet
        attackedTeam.userId = userId;
        attackedTeam.mana = 0; // Mac dinh quai se co Mana = 0
        // lay tat ca quai trong cung area ngay nhien ra 1 con de dap ung nhu cau cua minh
        let enemyPlay = {
            enemyId: enemyId,
            enemyCode: enemy.enemyCode,
            evolutionLevel: enemy.evolutionLevel,
            level: enemy.level,
            noiThuong: [], // Neu co thi giam 1
            phongThu: [], // Neu co thi giam 1
            dam: enemy.level * vlr.enemies[enemy.enemyCode].baseDame,
            totalHealth: enemy.level * vlr.enemies[enemy.enemyCode].baseHealth,
            elementCode: vlr.enemies[enemy.enemyCode].elementCode,
            nameEn: vlr.enemies[enemy.enemyCode].nameEn,
            nameVn: vlr.enemies[enemy.enemyCode].nameVn,
            infoVn: vlr.enemies[enemy.enemyCode].infoVn,
            infoEn: vlr.enemies[enemy.enemyCode].infoEn,
            infoEnVoice: vlr.enemies[enemy.enemyCode].infoEnVoice,
            infoVnVoice: vlr.enemies[enemy.enemyCode].infoVnVoice,
            status: 1,
            wasInBattle: 0,
            listSkill: common.getListSkill(vlr, vlr.enemies[enemy.enemyCode].elementCode, enemy.evolutionLevel, enemy.level, attackedTeam.mana)
        }
        enemyPlay.currentHealth = enemyPlay.totalHealth;
        //attackerTeam.currentHealth = currentHealth;
        //attackerTeam.totalHealth = totalHealth;
        attackedTeam.noiThuong = [];
        attackedTeam.phongThu = [];
        attackedTeam.attackerId = enemyPlay.enemyId;
        attackedTeam.lostTurn = 0;
        //attackerTeam.listMembers = listMembers;
        // Tinh toan health va member
        let listAttackedMembers = {};
        listAttackedMembers[enemyPlay.enemyId] = enemyPlay;
        attackedTotalHealth = attackedTotalHealth + enemyPlay.totalHealth;
        for (i = 0; i < enemyTeamNumber - 1; i++) {
            let newEnemy = {
                enemyId: enemyPlay.enemyId + 1 + i,
                enemyCode: enemyPlay.enemyCode,
                evolutionLevel: enemyPlay.evolutionLevel,
                level: enemyPlay.level,
                noiThuong: [], // Neu co thi giam 1
                phongThu: [], // Neu co thi giam 1
                dam: enemyPlay.dam,
                totalHealth: enemyPlay.totalHealth,
                currentHealth: enemyPlay.currentHealth,
                elementCode: enemyPlay.elementCode,
                nameEn: enemyPlay.nameEn,
                nameVn: enemyPlay.nameVn,
                infoVn: enemyPlay.infoVn,
                infoEn: enemyPlay.infoEn,
                infoEnVoice: enemyPlay.infoEnVoice,
                infoVnVoice: enemyPlay.infoVnVoice,
                status: 1,
                wasInBattle: 0,
                listSkill: common.getListSkill(vlr, enemyPlay.elementCode, enemyPlay.evolutionLevel, enemyPlay.level, attackedTeam.mana)
            }
            attackedTotalHealth = attackedTotalHealth + newEnemy.totalHealth;
            listAttackedMembers[newEnemy.enemyId] = newEnemy;
        }
        attackedTeam.totalHealth = attackedTotalHealth;
        attackedTeam.currentHealth = attackedTotalHealth;
        attackedTeam.listMembers = listAttackedMembers;
        enemyBattle.enemyTeam = attackedTeam;
        // Gui lai cho nguoi dung thong tin

        user.enemyBattleId = enemyBattle.battleId;

        //Gui thong tin huong dan tran
        res.status(200).json({
            error: 0,
            msg: 'Thong tin tran chien Okay',
            battleId: enemyBattle.battleId,
            user: attackerUser,
            humanTeam: attackerTeam,
            enemyTeam: attackedTeam,
            currentQuestion: user.currentQuestion,
            guide: user.currentAction.battleGuide != undefined ? user.currentAction.battleGuide : {}
        })
    } catch (e) {
        console.log('[Error]:tellStory:', e);
    }
}

const flute = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:flute:');
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId];
        let actionCode = req.body.actionCode;
        if (actionCode == undefined) {
            console.log("Action code null:");
            res.status(400).json({
                error: 1,
                msg: 'Du lieu actionCode null'
            })
            return;
        }
        // Xac dinh xem day co phai la action hien tai cua nguoi dung khong
        if (user.currentActionCode != actionCode) {
            // Sai ma action Code
            res.status(400).json({
                error: 1,
                msg: 'Du lieu actionCode sai'
            })
            return;
        }
        // Hoan thanh action
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

            if (user.currentAction.actionType == 18) {
                common.checkActionLevelUp(vlr, userId, poolWrite).then(dataLevel => {
                    res.status(200).json({
                        error: 0,
                        msg: 'Cap nhat thanh cong',
                        Status: dataLevel.status,
                        prize: dataLevel.prize,
                        currentTask: user.currentTask,
                        currentAction: user.currentAction,
                    })
                    return
                }).catch(errorLevel => {
                    console.log("Loi trong qua trinh update:", errorLevel);
                    res.status(502).json({
                        error: 1,
                        msg: 'Service Error'
                    })
                })
                return
            }

            // Send to client
            res.status(200).json({
                error: 0,
                msg: 'Cap nhat thanh cong',
                Status: data.status,
                prize: data.prize,
                currentTask: user.currentTask,
                currentAction: user.currentAction,
                taskEnemies: data.taskEnemies != undefined ? data.taskEnemies : [],
                taskGoods: data.taskGoods != undefined ? data.taskGoods : [],
                taskEvents: data.taskEvents != undefined ? data.taskEvents : [],
                taskNPCs: data.taskNPCs != undefined ? data.taskNPCs : [],
                actionEnemies: data.actionEnemies != undefined ? data.actionEnemies : [],
                actionGoods: data.actionGoods != undefined ? data.actionGoods : [],
                actionEvents: data.actionEvents != undefined ? data.actionEvents : [],
                actionNPCs: data.actionNPCs != undefined ? data.actionNPCs : []
            })
        }).catch(error => {
            console.log("Loi trong qua trinh update:", error);
            res.status(502).json({
                error: 1,
                msg: 'Service Error'
            })
        })
    } catch (e) {
        console.log('[Error]:flute:', e);

        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}

const putEnemiesTameTry = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:putEnemiesTameTry:');
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId];
        let battleId = req.body.battleId;
        let battle = vlr.listEnemyBattles[battleId];
        if (battle == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'Du lieu battleId null'
            })
            return;
        }
        // Kiem tra thong tin tran chien
        // Lay thong tin team quai
        let enemyTeam = battle.enemyTeam;

        let enemy = enemyTeam.listMembers[enemyTeam.turn.attackerId];
        if (enemy.tame == 0) {
            res.status(200).json({
                error: 1,
                msg: 'Mau lon hon 20'
            })
            return;
        }
        // kiem tra xem quai co chiu khong
        let rate = common.getRndInteger(0, 10);
        if (rate >= 7) {
            // Thy phuc khong thanh cong
            res.status(200).json({
                error: 2,
                msg: 'Quai khong chap nhan theo'
            })
            return;
        }

        battle.tamed = 1;
        res.status(200).json({
            error: 0,
            msg: 'Quai da bi bat'
        })
    } catch (error) {
        console.log('[Error]:putEnemiesTameTry:', error);

        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}

const putEnemiesTame = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:putEnemiesTame:');
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId];
        let battleId = req.body.battleId;
        let battle = vlr.listEnemyBattles[battleId];
        if (battle == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'Du lieu battleId null'
            })
            return;
        }
        // Kiem tra thong tin tran chien
        // Lay thong tin team quai
        let enemyTeam = battle.enemyTeam;
        let humanTeam = battle.humanTeam;
        let enemy = enemyTeam.listMembers[enemyTeam.turn.attackerId];
        if (battle.tamed == undefined) {
            res.status(200).json({
                error: 2,
                msg: 'Quai khong chap nhan theo'
            })
            return;
        } else if (battle.tamed != 1) {
            res.status(400).json({
                error: 2,
                msg: 'Quai khong chap nhan theo'
            })
            return;
        }
        // Quai chap nhan theo
        // Them vao team: ok
        // Neu con thua cho thi them vao doi hinh 3: ok
        // Thực hiện hoàn thành trận chiến: dang lam
        // Kiểm tra các điều kiện xem có nhiệm vụ không để
        let enemyCode = enemy.enemyCode;
        // let level = enemy.level;
        let evolutionLevel = enemy.evolutionLevel;
        //Them vao my pet va my team
        let studentEnemySql = 'insert into student_enemy (evolution_level, enemy_code, level, student_id) values ($1, $2, $3, $4) returning id, evolution_level, level, enemy_code';
        poolWrite.query(studentEnemySql, [evolutionLevel, enemyCode, 1, userId]).then(data => {
            if (data.rowCount < 1) {
                res.status(502).json({
                    error: 1,
                    msg: 'Service Error'
                })
                return
            }
            let petRecord = data.rows[0];
            if (user.myPets == undefined) {
                user.myPets = {}
            }
            // Can lay tu level suy ra kinh nghiem cho no. Khong the de no kinh nghiem bang 0 duoc.
            let pet = {
                enemyId: petRecord.id,
                evolutionLevel: petRecord.evolution_level,
                enemyCode: petRecord.enemy_code,
                level: petRecord.level,
                exp: 0
            }
            user.myPets[pet.enemyId] = pet;
            //Cho vao my team
            let teamMemberCount = Object.keys(user.myTeam).length;
            if (teamMemberCount < 3) {
                let studentTeamSql = 'insert into student_team (enemy_id, student_id, index) values ($1, $2, $3)';
                poolWrite.query(studentTeamSql, [pet.enemyId, userId, teamMemberCount + 1]);
                let teamMember = {
                    enemyId: pet.enemyId,
                    index: teamMemberCount + 1
                }
                user.myTeam[teamMember.enemyId] = teamMember;

            }


        })

        //Thuc hien chien thang xoa tran chien
        console.log('Nguoi da thang');
        // Lay prize
        common.getPrizeEnemyWon(vlr, poolWrite, humanTeam).then(dataPrize => {
            // Danh dau con quai nay tam thoi bị chet trong 2 phut đối với người dùng nay.(Sẽ phải sửa cả ở hàm join Area)
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
            // Xac dinh xem day co phai la action hien tai cua nguoi dung khong
            if (user.currentAction.actionType == 4) {
                //Khoi tao quai cua minh
                let petOfUser = {}
                for (i in user.myPets) {
                    if (petOfUser[user.myPets[i].enemyCode] == undefined) {
                        petOfUser[user.myPets[i].enemyCode] = 1
                    } else {
                        petOfUser[user.myPets[i].enemyCode] = petOfUser[user.myPets[i].enemyCode] + 1
                    }
                }
                let allRelationDone = false;
                let relationPetCode;
                let relationPetCount;
                let relation;
                for (i in user.currentAction.relation) {
                    //Trỏ tới relation đó
                    relation = user.currentAction.relation[i];
                    //Nếu relation không phải relation type enemy thì skip vòng lặp (tránh những type là goods, tiền)
                    if (relation.relationType != 0) {
                        continue;
                    };
                    relationPetCode = relation.relationCode;
                    relationPetCount = relation.relationCount;

                    //Quai nao cung duoc
                    if (relationPetCode != undefined) {
                        // Neu khong co quai thi false
                        if (petOfUser[relationPetCode] == undefined) {
                            allRelationDone = false;
                            continue
                        }
                        if (parseInt(petOfUser[relationPetCode]) < parseInt(relationPetCount)) {
                            allRelationDone = false;
                            continue
                        }
                    }
                    allRelationDone = true;
                }
                //Xoa object khi dung xong
                delete petOfUser;
                //Nếu allrelationDone là true thì thực hiện updateActionStatus
                if (allRelationDone == true) {
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


                        if (user.currentAction.actionType == 18) {
                            common.checkActionLevelUp(vlr, userId, poolWrite).then(dataLevel => {
                                res.status(200).json({
                                    error: 0,
                                    msg: 'Cap nhat thanh cong',
                                    Status: dataLevel.status,
                                    prize: dataLevel.prize,
                                    currentTask: user.currentTask,
                                    currentAction: user.currentAction,
                                })
                                return
                            }).catch(errorLevel => {
                                console.log("Loi trong qua trinh update:", errorLevel);
                                res.status(502).json({
                                    error: 1,
                                    msg: 'Service Error'
                                })
                            })
                            return
                        }

                        // Send to client
                        res.status(200).json({
                            error: 0,
                            msg: 'Cap nhat thanh cong',
                            Status: data.status,
                            prize: data.prize,
                            currentTask: user.currentTask,
                            currentAction: user.currentAction,
                            taskEnemies: data.taskEnemies != undefined ? data.taskEnemies : [],
                            taskGoods: data.taskGoods != undefined ? data.taskGoods : [],
                            taskEvents: data.taskEvents != undefined ? data.taskEvents : [],
                            taskNPCs: data.taskNPCs != undefined ? data.taskNPCs : [],
                            actionEnemies: data.actionEnemies != undefined ? data.actionEnemies : [],
                            actionGoods: data.actionGoods != undefined ? data.actionGoods : [],
                            actionEvents: data.actionEvents != undefined ? data.actionEvents : [],
                            actionNPCs: data.actionNPCs != undefined ? data.actionNPCs : []
                        })
                    }).catch(error => {
                        console.log("Loi trong qua trinh update:", error);
                        res.status(502).json({
                            error: 1,
                            msg: 'Service Error'
                        })
                    })
                }
            }


        })
            .catch(error =>
                console.log('prize error', error)
            );









    } catch (error) {
        console.log('[Error]:putEnemiesTame:', error);

        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}


const walkedGuide = function (req, res, poolWrite, poolRead, Aerospike, client, vlr, configuration, io) {
    try {
        console.log('[Start]:walkedGuide:');
        let userId = parseInt(req.headers['userid']);
        let user = vlr.listUsers[userId];
        let px = req.body.px;
        let py = req.body.py;

        if (user.currentAction.actionType != 27) {
            // Sai ma action Code
            res.status(400).json({
                error: 1,
                msg: 'Du lieu actionCode sai, khong phai type 27'
            })
            return;
        }
        if (user.currentAction.destinationX == undefined || user.currentAction.destinationY == undefined) {
            // Sai ma action Code
            res.status(400).json({
                error: 1,
                msg: 'nhiem vu nay ko co dich den x y sai'
            })
            return;
        }

        if (user.currentAction.destinationX == px && user.currentAction.destinationY == py) {
            common.updateActionStatus(vlr, userId, poolWrite).then(data => {
                // Cap nhat lai du lieu cho user
                console.log('Data nhiem vu:', data);
                user.currentActionCode = data.nextActionCode;
                user.currentTaskCode = data.nextTaskCode;
                delete user.currentAction;
                user.currentAction = vlr.actions.full[data.nextActionCode];
                delete user.currentTask;
                user.currentTask = vlr.tasks[data.nextTaskCode];
                // Cap nhat db
                let sql = 'update student set current_task_code = $1, current_action_code = $2 where id = $3';
                poolWrite.query(sql, [user.currentTaskCode, user.currentActionCode, userId]);

                if (user.currentAction.actionType == 18) {
                    common.checkActionLevelUp(vlr, userId, poolWrite).then(dataLevel => {
                        res.status(200).json({
                            error: 0,
                            msg: 'Cap nhat thanh cong',
                            Status: dataLevel.status,
                            prize: dataLevel.prize,
                            currentTask: user.currentTask,
                            currentAction: user.currentAction,
                        })
                        return
                    }).catch(errorLevel => {
                        console.log("Loi trong qua trinh update:", errorLevel);
                        res.status(502).json({
                            error: 1,
                            msg: 'Service Error'
                        })
                    })
                    return
                }

                // Send to client
                res.status(200).json({
                    error: 0,
                    msg: 'Cap nhat thanh cong',
                    Status: data.status,
                    prize: data.prize,
                    currentTask: user.currentTask,
                    currentAction: user.currentAction,
                    taskEnemies: data.taskEnemies != undefined ? data.taskEnemies : [],
                    taskGoods: data.taskGoods != undefined ? data.taskGoods : [],
                    taskEvents: data.taskEvents != undefined ? data.taskEvents : [],
                    taskNPCs: data.taskNPCs != undefined ? data.taskNPCs : [],
                    actionEnemies: data.actionEnemies != undefined ? data.actionEnemies : [],
                    actionGoods: data.actionGoods != undefined ? data.actionGoods : [],
                    actionEvents: data.actionEvents != undefined ? data.actionEvents : [],
                    actionNPCs: data.actionNPCs != undefined ? data.actionNPCs : []
                })
            }).catch(error => {
                console.log("Loi trong qua trinh update:", error);
                res.status(502).json({
                    error: 1,
                    msg: 'Service Error'
                })
            })
        } else {
            res.status(400).json({
                error: 1,
                msg: 'x y sai'
            })
            return;
        }
        // Hoan thanh action

    } catch (e) {
        console.log('[Error]:walkedGuide:', e);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }
}

const deleteHumansBattles = function (vlr, req, res) {
    try {
        let battleId = req.body.battleId;
        let battle = vlr.listHumanBattles[battleId];
        if (battle == undefined) {
            res.status(400).json({
                error: 1,
                msg: 'Sai ma tran'
            })
            return;
        }
        let user1 = vlr.listUsers[battle.attacker];
        let user2 = vlr.listUsers[battle.attacked];
        if (user1 != undefined) delete user1.humanBattleId;
        if (user2 != undefined) delete user2.humanBattleId;
        delete vlr.listHumanBattles[battleId]
        res.status(200).json({
            error: 0,
            msg: 'Xoa thanh cong',
            battleId: battleId
        })

    } catch (error) {
        console.log('deleteHumansBattles:', error);
        res.status(502).json({
            error: 1,
            msg: 'Service Error'
        })
    }

}

module.exports = {
    joinWorlds,
    userLogout,
    userInfo,
    userClasses,
    userNames,
    userCharacters,
    postUsersFriends,
    putUsersFriends,
    getUsersFriends,
    getUsersHouse,
    getUsersTeams,
    putUserTeams,
    getUsersInfo,
    getMyPets,
    getMaps,
    getUsersEnemiesDetail,
    getUsersGoods,
    getUsersMoney,
    postUsersTrans,
    getAreaNPCs,
    getNPCShop,
    putUsersPets,
    putUsersWands,
    putUsersHats,
    putUsersOutfits,
    putUsersBoots,
    putUsersRings,
    putUsersHairStyles,
    putUsersHairColors,
    putUsersSkinColors,
    postUsersEnemies,
    postUsersEnemiesBattles,
    postHumansBattles,
    putHumansBattles,
    postBossesBattles,
    getHouses,
    putUsersHouses,
    postUsersGoods,
    putHousesFurniture,
    postUsersTameEnemies,
    changeArea,
    listenned,
    talked,
    gotEnemy,
    returnedEnemy,
    returnedGoods,
    putOutFire,
    returnedForest,
    meet,
    tellStory,
    putUsersGoodsPicked,
    createEnemyBattle,
    flute,
    putEnemiesTameTry,
    putEnemiesTame,
    walkedGuide,
    deleteHumansBattles
}