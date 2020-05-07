import chai = require("chai");
import Database from "../../src/Database/Database";
import * as sqlite3 from "sqlite3";
import faker from "faker";
import * as winston from "winston";

describe("QueryBuilder", function () {
    let db: Database;
    let users = [];

    function getRandomUser() {
        let index = Math.floor((users.length - 1) * Math.random());
        let user = users[index];
        return {index, user};
    }

    before(async function () {
        db = new Database("test", new sqlite3.Database(":memory:"), []);
        await db.table("users").create(table => {
            table.string("id").unique();
            table.string("name");
        }).exec();

        for (let i = 0; i < 10; i++) {
            users.push({
                id: faker.random.uuid(), name: faker.internet.userName()
            });
        }
        let query = db.table("users").insert(users);
        query.toSql().should.eq("INSERT INTO users (id, name) VALUES ($id, $name);");
        let ids = await query.exec();
        ids.length.should.eq(10);

        await db.table("permissions").create(table => {
            table.string("permission");
            table.string("user_id").references("users", "id");
            table.boolean("allowed");
            table.unique("UniqueUserPermission", ["permission", "user_id"]);
        }).exec();
    });

    describe("#select", function () {
        it("should select all of the users", async function() {
            let query = db.table("users").select();
            query.toSql().should.eq("SELECT * FROM users;");
            let rows = await query.all();
            rows.should.deep.eq(users);
        });

        it("should select a specific user", async function () {
            let user = users[Math.floor(users.length * Math.random())];
            let query = db.table("users").select().where().eq("id", user.id).done();
            query.toSql().should.eq("SELECT * FROM users WHERE id = $id;");
            let row = await query.first();
            row.should.deep.eq(user);
        });

        it("should select a few users", async function () {
            let users2 = [
                users[Math.floor(users.length * Math.random())],
                users[Math.floor(users.length * Math.random())]
            ];

            let query = db.table("users").select()
                .where()
                .or(where => {
                    where.eq("id", users2[0].id);
                    where.eq("id", users2[1].id);
                })
                .done();
            query.toSql().should.eq("SELECT * FROM users WHERE (id = $id OR id = $id1);");
            let rows = await query.all();
            rows.should.deep.include(users2[0]);
            rows.should.deep.include(users2[1]);
        });
    });

    describe("#update", function () {
        it("should update a user", async function () {
            let i = Math.floor(users.length * Math.random());
            let id = users[i].id;
            let name = faker.internet.userName();
            users[i].name = name;

            let query = db.table("users").update({ name }).where().eq("id", id).done();
            query.toSql().should.eq("UPDATE users SET name = $name WHERE id = $id;");
            await query.exec();

            let row = await db.table("users").select().where().eq("id", id).done().first();
            row.name.should.eq(name);
        });
    });

    describe("#delete", function () {
        it("should delete a user", async function() {
            let { index, user } = getRandomUser();
            users.splice(index, 1);

            let query = db.table("users").delete().where().eq("id", user.id).done();
            query.toSql().should.eq("DELETE FROM users WHERE id = $id;");
            await query.exec();

            let rows = await db.table("users").select().where().eq("id", user.id).done().all();
            rows.length.should.eq(0);
        });

        it("should delete multiple users", async function() {
            let randomUser1 = getRandomUser();
            let randomUser2 = getRandomUser();
            users.splice(randomUser1.index, 1);
            users.splice(randomUser2.index, 1);

            let orClause = where => {
                where.eq("id", randomUser1.user.id);
                where.eq("id", randomUser2.user.id);
            };
            let query = db.table("users").delete().where().or(orClause).done();
            query.toSql().should.eq("DELETE FROM users WHERE (id = $id OR id = $id1);");
            await query.exec();

            let rows = await db.table("users").select().where().or(orClause).done().all();
            rows.length.should.eq(0);
        });
    });

    describe("#insert", function () {
        it("should replace existing user", async function() {
            let {index, user} = getRandomUser();
            let id = user.id;
            let name = faker.internet.userName();
            users[index].name = name;

            let query = db.table("users").insert({ id, name }).or("REPLACE");
            query.toSql().should.eq("INSERT OR REPLACE INTO users (id, name) VALUES ($id, $name);");
            await query.exec();

            let row = await db.table("users").select().where().eq("id", id).done().first();
            row.name.should.eq(name);
        });

        it("should insert non-existent user", async function() {
            let id = faker.random.uuid();
            let name = faker.internet.userName();
            users.push({ id, name });

            let query = db.table("users").insert({ id, name }).or("REPLACE");
            query.toSql().should.eq("INSERT OR REPLACE INTO users (id, name) VALUES ($id, $name);");
            await query.exec();

            let rows = await db.table("users").select().where().eq("id", id).done().all();
            rows.length.should.eq(1);
        });

        it("should fail to insert existing permission",  function(done) {
            let { user } = getRandomUser();
            let allowed = faker.random.boolean();
            let permission = "random_permission";
            db.table("permissions").insert({ permission, user_id: user.id, allowed }).exec()
                .then(() => db.table("permissions").insert({ permission, user_id: user.id, allowed }).exec())
                .then(() => done(new Error("Insert query did not throw an error")))
                .catch(() => done());
        });

        it("should not fail to insert non-existent permission",  async function() {
            let { user } = getRandomUser();
            let { user: user2 } = getRandomUser();
            let allowed = faker.random.boolean();
            let permission = "random_permission2";
            await db.table("permissions").insert({ permission, user_id: user.id, allowed }).exec();
            await db.table("permissions").insert({ permission, user_id: user2.id, allowed }).exec();
        });
    });
});