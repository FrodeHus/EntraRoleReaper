using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Data.Migrations
{
    /// <inheritdoc />
    public partial class v044 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "TargetResourceId",
                table: "Activities",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ActivityTargetResource",
                columns: table => new
                {
                    ActivitiesId = table.Column<Guid>(type: "TEXT", nullable: false),
                    TargetResourcesId = table.Column<Guid>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ActivityTargetResource", x => new { x.ActivitiesId, x.TargetResourcesId });
                    table.ForeignKey(
                        name: "FK_ActivityTargetResource_Activities_ActivitiesId",
                        column: x => x.ActivitiesId,
                        principalTable: "Activities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ActivityTargetResource_TargetResources_TargetResourcesId",
                        column: x => x.TargetResourcesId,
                        principalTable: "TargetResources",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Activities_TargetResourceId",
                table: "Activities",
                column: "TargetResourceId");

            migrationBuilder.CreateIndex(
                name: "IX_ActivityTargetResource_TargetResourcesId",
                table: "ActivityTargetResource",
                column: "TargetResourcesId");

            migrationBuilder.AddForeignKey(
                name: "FK_Activities_TargetResources_TargetResourceId",
                table: "Activities",
                column: "TargetResourceId",
                principalTable: "TargetResources",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Activities_TargetResources_TargetResourceId",
                table: "Activities");

            migrationBuilder.DropTable(
                name: "ActivityTargetResource");

            migrationBuilder.DropIndex(
                name: "IX_Activities_TargetResourceId",
                table: "Activities");

            migrationBuilder.DropColumn(
                name: "TargetResourceId",
                table: "Activities");
        }
    }
}
